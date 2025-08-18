import React, { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, Download, Eye, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfDay, endOfDay, addDays, subDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';

interface EODReport {
  id: string;
  driver_id: string;
  submitted_at: string;
  name: string;
  round_1_number?: string;
  round_2_number?: string;
  round_3_number?: string;
  round_4_number?: string;
  did_support: boolean;
  support_parcels: number;
  successful_deliveries: number;
  successful_collections: number;
  has_company_van: boolean;
  van_registration?: string;
  total_parcels: number;
  round_start_time?: string;
  round_end_time?: string;
  app_screenshot?: string;
  created_at: string;
  updated_at: string;
}

const EODReports = () => {
  const { profile } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDriver, setSelectedDriver] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  const dayStart = startOfDay(currentDate);
  const dayEnd = endOfDay(currentDate);

  // Fetch user companies
  const { data: userCompanies } = useQuery({
    queryKey: ['user-companies', profile?.user_id],
    queryFn: async () => {
      if (!profile?.user_id) return [];

      const { data, error } = await supabase
        .from('user_companies')
        .select('company_id, role, companies(id, name)')
        .eq('user_id', profile.user_id);

      if (error) throw error;
      return data;
    },
    enabled: !!profile?.user_id,
  });

  const companyIds = userCompanies?.map(uc => uc.company_id) || [];

  // Fetch drivers for filtering
  const { data: drivers } = useQuery({
    queryKey: ['drivers-for-filter', companyIds],
    queryFn: async () => {
      if (companyIds.length === 0) return [];

      const { data, error } = await supabase
        .rpc('get_drivers_with_profiles', { company_ids: companyIds });

      if (error) throw error;
      return data;
    },
    enabled: companyIds.length > 0,
  });

  // Fetch EOD reports
  const { data: reports, isLoading, error } = useQuery({
    queryKey: ['eod-reports', companyIds, selectedDriver, dayStart.toISOString()],
    queryFn: async () => {
      if (companyIds.length === 0) return [];

      let query = supabase
        .from('end_of_day_reports')
        .select(`
          *,
          driver_profiles!inner(
            id,
            user_id,
            company_id,
            profiles!inner(first_name, last_name)
          )
        `)
        .in('driver_profiles.company_id', companyIds)
        .gte('submitted_at', dayStart.toISOString())
        .lte('submitted_at', dayEnd.toISOString())
        .order('submitted_at', { ascending: false });

      // Filter by specific driver
      if (selectedDriver && selectedDriver !== 'all') {
        query = query.eq('driver_id', selectedDriver);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as EODReport[];
    },
    enabled: companyIds.length > 0,
  });

  // Filter reports by search term
  const filteredReports = useMemo(() => {
    if (!reports) return [];
    
    if (!searchTerm.trim()) return reports;
    
    return reports.filter(report => 
      report.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.van_registration?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      [report.round_1_number, report.round_2_number, report.round_3_number, report.round_4_number]
        .filter(Boolean)
        .some(round => round?.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [reports, searchTerm]);

  const handleExportCSV = () => {
    if (!filteredReports || filteredReports.length === 0) {
      toast({
        title: "No Data",
        description: "No reports available to export.",
        variant: "destructive",
      });
      return;
    }

    const headers = [
      'Driver Name',
      'Submitted At',
      'Round 1',
      'Round 2', 
      'Round 3',
      'Round 4',
      'Support Work',
      'Support Parcels',
      'Successful Deliveries',
      'Successful Collections',
      'Total Parcels',
      'Company Van',
      'Van Registration',
      'Round Start Time',
      'Round End Time',
      'Screenshot'
    ];

    const csvContent = [
      headers.join(','),
      ...filteredReports.map(report => [
        `"${report.name}"`,
        `"${format(new Date(report.submitted_at), 'yyyy-MM-dd HH:mm:ss')}"`,
        `"${report.round_1_number || ''}"`,
        `"${report.round_2_number || ''}"`,
        `"${report.round_3_number || ''}"`,
        `"${report.round_4_number || ''}"`,
        report.did_support ? 'Yes' : 'No',
        report.support_parcels,
        report.successful_deliveries,
        report.successful_collections,
        report.total_parcels,
        report.has_company_van ? 'Yes' : 'No',
        `"${report.van_registration || ''}"`,
        report.round_start_time ? `"${format(new Date(report.round_start_time), 'yyyy-MM-dd HH:mm:ss')}"` : '',
        report.round_end_time ? `"${format(new Date(report.round_end_time), 'yyyy-MM-dd HH:mm:ss')}"` : '',
        report.app_screenshot ? 'Yes' : 'No'
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `eod-reports-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Export Successful",
      description: "EOD reports have been exported to CSV.",
    });
  };

  const navigateDay = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => direction === 'prev' ? subDays(prev, 1) : addDays(prev, 1));
  };

  const viewScreenshot = async (screenshotPath: string) => {
    try {
      const { data } = await supabase.storage
        .from('eod-screenshots')
        .createSignedUrl(screenshotPath, 3600); // 1 hour expiry

      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      } else {
        throw new Error('Failed to generate signed URL');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load screenshot.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <div className="container mx-auto py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p>Loading EOD reports...</p>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  if (error) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <div className="container mx-auto py-8">
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-destructive">
                  Error loading EOD reports: {(error as Error).message}
                </p>
              </CardContent>
            </Card>
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <div className="flex h-16 items-center justify-between px-4 border-b">
          <div className="flex items-center gap-2">
            <SidebarTrigger />
            <div>
              <h1 className="text-2xl font-semibold">End of Day Reports</h1>
              <p className="text-sm text-muted-foreground">Daily view of driver EOD submissions</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <Button variant="outline" onClick={() => navigateDay('prev')}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-sm font-semibold min-w-[120px] text-center">
              {format(currentDate, 'MMM dd, yyyy')}
            </div>
            <Button variant="outline" onClick={() => navigateDay('next')}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        <div className="container mx-auto py-8 space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-muted-foreground">
                View and manage driver EOD submissions
              </p>
            </div>
            <Button onClick={handleExportCSV} className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>

          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Filters</CardTitle>
              <CardDescription>Filter reports by driver, date, or search term</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Driver Filter */}
                <div className="space-y-2">
                  <Label>Driver</Label>
                  <Select value={selectedDriver} onValueChange={setSelectedDriver}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select driver" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Drivers</SelectItem>
                      {drivers?.map((driver) => (
                        <SelectItem key={driver.id} value={driver.id}>
                          {driver.first_name} {driver.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Search */}
                <div className="space-y-2">
                  <Label htmlFor="search">Search</Label>
                  <Input
                    id="search"
                    placeholder="Search by name, van reg, rounds..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                {/* Clear Filters */}
                <div className="space-y-2">
                  <Label>&nbsp;</Label>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setSelectedDriver('all');
                      setSearchTerm('');
                    }}
                    className="w-full"
                  >
                    Clear Filters
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Reports Table */}
          <Card>
            <CardHeader>
              <CardTitle>Reports ({filteredReports?.length || 0})</CardTitle>
            </CardHeader>
            <CardContent>
              {filteredReports && filteredReports.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Driver</TableHead>
                        <TableHead>Submitted</TableHead>
                        <TableHead>Rounds</TableHead>
                        <TableHead>Deliveries</TableHead>
                        <TableHead>Collections</TableHead>
                        <TableHead>Support</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Van</TableHead>
                        <TableHead>Timing</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredReports.map((report) => (
                        <TableRow key={report.id}>
                          <TableCell className="font-medium">
                            {report.name}
                          </TableCell>
                          <TableCell>
                            {format(new Date(report.submitted_at), 'MMM dd, yyyy HH:mm')}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {[report.round_1_number, report.round_2_number, report.round_3_number, report.round_4_number]
                                .filter(Boolean)
                                .map((round, index) => (
                                  <Badge key={index} variant="outline" className="text-xs">
                                    {round}
                                  </Badge>
                                ))}
                            </div>
                          </TableCell>
                          <TableCell>{report.successful_deliveries}</TableCell>
                          <TableCell>{report.successful_collections}</TableCell>
                          <TableCell>
                            {report.did_support ? (
                              <Badge variant="secondary">{report.support_parcels}</Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="default">{report.total_parcels}</Badge>
                          </TableCell>
                          <TableCell>
                            {report.has_company_van ? (
                              <div>
                                <Badge variant="outline">Company</Badge>
                                {report.van_registration && (
                                  <div className="text-xs text-muted-foreground mt-1">
                                    {report.van_registration}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">Personal</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {report.round_start_time && report.round_end_time ? (
                              <div className="text-xs">
                                <div>{format(new Date(report.round_start_time), 'HH:mm')}</div>
                                <div>to</div>
                                <div>{format(new Date(report.round_end_time), 'HH:mm')}</div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              {report.app_screenshot && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => viewScreenshot(report.app_screenshot!)}
                                >
                                  <Eye className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Reports Found</h3>
                  <p className="text-muted-foreground">
                    {searchTerm || selectedDriver !== 'all'
                      ? "No reports match your current filters."
                      : "No EOD reports have been submitted yet."}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default EODReports;