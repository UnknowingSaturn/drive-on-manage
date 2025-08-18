import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Package, Eye, Search, Filter, Download, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfWeek, addDays, addWeeks, subWeeks } from 'date-fns';

const StartOfDayReports = () => {
  const { profile } = useAuth();
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [selectedDriver, setSelectedDriver] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [previewImage, setPreviewImage] = useState<string>('');
  
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 }); // Monday start
  const weekEnd = addDays(weekStart, 6);

  // Get user companies first
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

  // Get company drivers
  const { data: drivers } = useQuery({
    queryKey: ['company-drivers', companyIds],
    queryFn: async () => {
      if (companyIds.length === 0) return [];
      
      const { data, error } = await supabase
        .rpc('get_drivers_with_profiles', { company_ids: companyIds });

      if (error) throw error;
      return data;
    },
    enabled: companyIds.length > 0
  });

  // Get SOD reports with filters
  const { data: reports, isLoading } = useQuery({
    queryKey: ['sod-reports', companyIds, weekStart.toISOString(), selectedDriver, searchQuery],
    queryFn: async () => {
      if (companyIds.length === 0) return [];

      let query = supabase
        .from('start_of_day_reports')
        .select(`
          *,
          driver_profiles!inner(
            user_id,
            company_id,
            profiles!inner(
              first_name,
              last_name,
              email
            )
          )
        `)
        .in('driver_profiles.company_id', companyIds)
        .gte('submitted_at', weekStart.toISOString())
        .lte('submitted_at', weekEnd.toISOString())
        .order('submitted_at', { ascending: false });

      // Apply driver filter
      if (selectedDriver && selectedDriver !== 'all') {
        query = query.eq('driver_id', selectedDriver);
      }

      const { data } = await query;

      // Apply search filter on client side
      let filteredData = data || [];
      if (searchQuery) {
        const searchLower = searchQuery.toLowerCase();
        filteredData = filteredData.filter(report => 
          report.name.toLowerCase().includes(searchLower) ||
          report.round_number.toLowerCase().includes(searchLower) ||
          (report.extracted_round_number && report.extracted_round_number.toLowerCase().includes(searchLower))
        );
      }

      return filteredData;
    },
    enabled: companyIds.length > 0
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default">Processed</Badge>;
      case 'processing':
        return <Badge variant="secondary">Processing</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  const getImageUrl = async (path: string) => {
    if (!path) return '';
    const { data } = await supabase.storage
      .from('sod-screenshots')
      .createSignedUrl(path, 3600); // 1 hour expiry
    return data?.signedUrl || '';
  };

  const handleImagePreview = async (path: string) => {
    const url = await getImageUrl(path);
    setPreviewImage(url);
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    setCurrentWeek(prev => direction === 'prev' ? subWeeks(prev, 1) : addWeeks(prev, 1));
  };

  const exportToCSV = () => {
    if (!reports || reports.length === 0) return;

    const csvData = reports.map(report => ({
      Date: format(new Date(report.submitted_at), 'yyyy-MM-dd HH:mm'),
      Driver: report.name,
      'Selected Round': report.round_number,
      'Detected Round': report.extracted_round_number || '',
      'Heavy Parcels': report.heavy_parcels || 0,
      'Standard': report.standard || 0,
      'Hanging Garments': report.hanging_garments || 0,
      'Packets': report.packets || 0,
      'Small Packets': report.small_packets || 0,
      'Postables': report.postables || 0,
      'Status': report.processing_status
    }));

    const headers = Object.keys(csvData[0]);
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => headers.map(header => `"${row[header as keyof typeof row]}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sod-reports-week-${format(weekStart, 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        
        <SidebarInset className="flex-1">
          <header className="border-b bg-card sticky top-0 z-10">
            <div className="flex items-center justify-between mobile-padding py-3 md:py-4">
              <div className="flex items-center space-x-3">
                <SidebarTrigger className="mr-2" />
                <div>
                  <h1 className="mobile-heading font-semibold text-foreground">Start of Day Reports</h1>
                  <p className="text-xs md:text-sm text-muted-foreground">Weekly view of driver manifest uploads</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <Button variant="outline" onClick={() => navigateWeek('prev')}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="text-sm font-semibold min-w-[120px] text-center">
                  Week of {format(weekStart, 'MMM dd')}
                </div>
                <Button variant="outline" onClick={() => navigateWeek('next')}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button onClick={exportToCSV} variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </div>
          </header>

          <main className="mobile-padding py-4 md:py-6 space-y-4 md:space-y-6">
            {/* Filters */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Filter className="h-5 w-5 text-primary mr-2" />
                  Filters
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Driver</Label>
                    <Select value={selectedDriver} onValueChange={setSelectedDriver}>
                      <SelectTrigger>
                        <SelectValue placeholder="All drivers" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All drivers</SelectItem>
                        {drivers?.map((driver) => (
                          <SelectItem key={driver.id} value={driver.id}>
                            {driver.first_name} {driver.last_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="search">Search</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="search"
                        placeholder="Search by name or round..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="flex items-end">
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setSelectedDriver('all');
                        setSearchQuery('');
                      }}
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
                <CardTitle className="flex items-center">
                  <Package className="h-5 w-5 text-primary mr-2" />
                  Start of Day Reports
                </CardTitle>
                <CardDescription>
                  Total reports: {reports?.length || 0}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                    <p>Loading reports...</p>
                  </div>
                ) : reports && reports.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date/Time</TableHead>
                          <TableHead>Driver</TableHead>
                          <TableHead>Selected Round</TableHead>
                          <TableHead>Detected Round</TableHead>
                          <TableHead>Heavy</TableHead>
                          <TableHead>Standard</TableHead>
                          <TableHead>Hanging</TableHead>
                          <TableHead>Packets</TableHead>
                          <TableHead>Small</TableHead>
                          <TableHead>Postables</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reports.map((report) => (
                          <TableRow key={report.id}>
                            <TableCell>
                              <div className="font-medium">
                                {format(new Date(report.submitted_at), 'dd/MM/yyyy')}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {format(new Date(report.submitted_at), 'HH:mm')}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">{report.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {report.driver_profiles.profiles.email}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{report.round_number}</Badge>
                            </TableCell>
                            <TableCell>
                              {report.extracted_round_number ? (
                                <Badge variant="secondary">{report.extracted_round_number}</Badge>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">{report.heavy_parcels || 0}</TableCell>
                            <TableCell className="text-center">{report.standard || 0}</TableCell>
                            <TableCell className="text-center">{report.hanging_garments || 0}</TableCell>
                            <TableCell className="text-center">{report.packets || 0}</TableCell>
                            <TableCell className="text-center">{report.small_packets || 0}</TableCell>
                            <TableCell className="text-center">{report.postables || 0}</TableCell>
                            <TableCell>{getStatusBadge(report.processing_status)}</TableCell>
                            <TableCell>
                              {report.screenshot_url && (
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button 
                                      variant="outline" 
                                      size="sm"
                                      onClick={() => handleImagePreview(report.screenshot_url)}
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent className="max-w-4xl">
                                    <DialogHeader>
                                      <DialogTitle>Manifest Screenshot - {report.name}</DialogTitle>
                                    </DialogHeader>
                                    <div className="flex justify-center">
                                      {previewImage && (
                                        <img 
                                          src={previewImage} 
                                          alt="Manifest screenshot" 
                                          className="max-h-96 object-contain rounded-lg"
                                        />
                                      )}
                                    </div>
                                  </DialogContent>
                                </Dialog>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No Start of Day reports found</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Reports will appear here when drivers submit their manifests
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </main>
        </SidebarInset>
      </div>

      {/* Image Preview Dialog */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage('')}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Manifest Screenshot</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center">
            {previewImage && (
              <img 
                src={previewImage} 
                alt="Manifest screenshot" 
                className="max-h-96 object-contain rounded-lg"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
};

export default StartOfDayReports;