import React, { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CalendarDays, Download, Filter, Eye, FileText, Calendar } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

const AdminReports = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState('daily');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedDriver, setSelectedDriver] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState('');

  // Calculate date range based on selection
  const getDateRange = () => {
    const selected = new Date(selectedDate);
    switch (dateRange) {
      case 'weekly':
        return {
          start: startOfWeek(selected, { weekStartsOn: 1 }),
          end: endOfWeek(selected, { weekStartsOn: 1 })
        };
      case 'monthly':
        return {
          start: startOfMonth(selected),
          end: endOfMonth(selected)
        };
      default:
        return {
          start: selected,
          end: selected
        };
    }
  };

  const { start: startDate, end: endDate } = getDateRange();

  // Fetch drivers for filter
  const { data: drivers = [] } = useQuery({
    queryKey: ['drivers', profile?.user_companies],
    queryFn: async () => {
      if (!profile?.user_companies?.length) return [];
      
      const companyIds = profile.user_companies.map(uc => uc.company_id);
      const { data, error } = await supabase
        .rpc('get_drivers_with_profiles', { company_ids: companyIds });

      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.user_companies?.length
  });

  // Fetch EOD Reports
  const { data: eodReports = [], isLoading: eodLoading } = useQuery({
    queryKey: ['eod-reports', startDate, endDate, selectedDriver],
    queryFn: async () => {
      if (!profile?.user_companies?.length) return [];

      const companyIds = profile.user_companies.map(uc => uc.company_id);
      
      // Get EOD reports with driver profiles
      let eodQuery = supabase
        .from('eod_reports')
        .select('*')
        .in('company_id', companyIds)
        .gte('log_date', format(startDate, 'yyyy-MM-dd'))
        .lte('log_date', format(endDate, 'yyyy-MM-dd'))
        .order('log_date', { ascending: false });

      if (selectedDriver !== 'all') {
        eodQuery = eodQuery.eq('driver_id', selectedDriver);
      }

      const { data: eodData, error: eodError } = await eodQuery;
      if (eodError) throw eodError;

      // Get driver profiles and user profiles separately
      const driverIds = [...new Set(eodData?.map(report => report.driver_id))];
      if (driverIds.length === 0) return [];

      const { data: driverProfiles, error: driverError } = await supabase
        .from('driver_profiles')
        .select('id, user_id')
        .in('id', driverIds);

      if (driverError) throw driverError;

      const userIds = driverProfiles?.map(dp => dp.user_id) || [];
      const { data: userProfiles, error: userError } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, email')
        .in('user_id', userIds);

      if (userError) throw userError;

      // Combine the data
      return eodData?.map(report => {
        const driverProfile = driverProfiles?.find(dp => dp.id === report.driver_id);
        const userProfile = userProfiles?.find(up => up.user_id === driverProfile?.user_id);
        return {
          ...report,
          profiles: userProfile
        };
      }) || [];
    },
    enabled: !!profile?.user_companies?.length
  });

  // Fetch SOD Reports
  const { data: sodReports = [], isLoading: sodLoading } = useQuery({
    queryKey: ['sod-reports', startDate, endDate, selectedDriver],
    queryFn: async () => {
      if (!profile?.user_companies?.length) return [];

      const companyIds = profile.user_companies.map(uc => uc.company_id);
      
      // Get SOD reports with driver profiles
      let sodQuery = supabase
        .from('start_of_day_reports')
        .select('*')
        .in('company_id', companyIds)
        .gte('submitted_at', format(startDate, 'yyyy-MM-dd'))
        .lte('submitted_at', format(endDate, 'yyyy-MM-dd'))
        .order('submitted_at', { ascending: false });

      if (selectedDriver !== 'all') {
        sodQuery = sodQuery.eq('driver_id', selectedDriver);
      }

      const { data: sodData, error: sodError } = await sodQuery;
      if (sodError) throw sodError;

      // Get driver profiles and user profiles separately
      const driverIds = [...new Set(sodData?.map(report => report.driver_id))];
      if (driverIds.length === 0) return [];

      const { data: driverProfiles, error: driverError } = await supabase
        .from('driver_profiles')
        .select('id, user_id')
        .in('id', driverIds);

      if (driverError) throw driverError;

      const userIds = driverProfiles?.map(dp => dp.user_id) || [];
      const { data: userProfiles, error: userError } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, email')
        .in('user_id', userIds);

      if (userError) throw userError;

      // Combine the data
      return sodData?.map(report => {
        const driverProfile = driverProfiles?.find(dp => dp.id === report.driver_id);
        const userProfile = userProfiles?.find(up => up.user_id === driverProfile?.user_id);
        return {
          ...report,
          profiles: userProfile
        };
      }) || [];
    },
    enabled: !!profile?.user_companies?.length
  });

  // Filter reports based on search term
  const filteredEodReports = useMemo(() => {
    if (!searchTerm) return eodReports;
    return eodReports.filter(report => 
      report.profiles?.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.profiles?.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.profiles?.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [eodReports, searchTerm]);

  const filteredSodReports = useMemo(() => {
    if (!searchTerm) return sodReports;
    return sodReports.filter(report => 
      report.profiles?.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.profiles?.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.profiles?.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [sodReports, searchTerm]);

  // Export to CSV
  const exportToCSV = (data: any[], type: 'eod' | 'sod') => {
    const headers = type === 'eod' 
      ? ['Date', 'Driver', 'Email', 'Parcels Delivered', 'Cover Parcels', 'Status', 'Screenshot']
      : ['Date', 'Driver', 'Email', 'Round Number', 'Total Deliveries', 'Total Collections', 'Status', 'Screenshot'];

    const csvContent = [
      headers.join(','),
      ...data.map(report => {
        const driverName = `${report.profiles?.first_name || ''} ${report.profiles?.last_name || ''}`.trim();
        if (type === 'eod') {
          return [
            format(new Date(report.log_date), 'yyyy-MM-dd'),
            driverName,
            report.profiles?.email || '',
            report.parcels_delivered || 0,
            report.cover_parcels || 0,
            report.status || '',
            report.screenshot_url ? 'Yes' : 'No'
          ].join(',');
        } else {
          return [
            format(new Date(report.submitted_at), 'yyyy-MM-dd'),
            driverName,
            report.profiles?.email || '',
            report.round_number || '',
            report.total_deliveries || 0,
            report.total_collections || 0,
            report.processing_status || '',
            report.screenshot_url ? 'Yes' : 'No'
          ].join(',');
        }
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}-reports-${format(startDate, 'yyyy-MM-dd')}-to-${format(endDate, 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // View screenshot
  const viewScreenshot = async (screenshotUrl: string) => {
    try {
      // Determine bucket based on screenshot URL
      const bucket = screenshotUrl.includes('sod-') ? 'sod-screenshots' : 'eod-screenshots';
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(screenshotUrl, 3600);

      if (error) throw error;
      setSelectedImage(data.signedUrl);
      setImageModalOpen(true);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load screenshot",
        variant: "destructive",
      });
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        
        <SidebarInset className="flex-1">
          <header className="border-b bg-card sticky top-0 z-10">
            <div className="flex items-center px-4 py-4">
              <SidebarTrigger className="mr-4" />
              <div>
                <h1 className="text-xl font-semibold text-foreground">Reports</h1>
                <p className="text-sm text-muted-foreground">View driver submission reports</p>
              </div>
            </div>
          </header>

          <main className="p-6 space-y-6">
            {/* Filters */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Filter className="h-5 w-5 mr-2" />
                  Filters
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="date-range">Date Range</Label>
                    <Select value={dateRange} onValueChange={setDateRange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="selected-date">Date</Label>
                    <Input
                      id="selected-date"
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="driver-filter">Driver</Label>
                    <Select value={selectedDriver} onValueChange={setSelectedDriver}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Drivers</SelectItem>
                        {drivers.map((driver) => (
                          <SelectItem key={driver.id} value={driver.id}>
                            {driver.first_name} {driver.last_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="search">Search</Label>
                    <Input
                      id="search"
                      placeholder="Search drivers..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Reports Tabs */}
            <Tabs defaultValue="eod" className="space-y-6">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="eod" className="flex items-center">
                  <FileText className="h-4 w-4 mr-2" />
                  End of Day Reports
                </TabsTrigger>
                <TabsTrigger value="sod" className="flex items-center">
                  <Calendar className="h-4 w-4 mr-2" />
                  Start of Day Reports
                </TabsTrigger>
              </TabsList>

              <TabsContent value="eod" className="space-y-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>End of Day Reports</CardTitle>
                      <CardDescription>
                        {format(startDate, 'MMM d, yyyy')} {dateRange !== 'daily' && `- ${format(endDate, 'MMM d, yyyy')}`}
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => exportToCSV(filteredEodReports, 'eod')}
                      className="flex items-center"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export CSV
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {eodLoading ? (
                      <div className="text-center py-8">Loading reports...</div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Driver</TableHead>
                            <TableHead>Parcels Delivered</TableHead>
                            <TableHead>Cover Parcels</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Screenshot</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredEodReports.map((report) => (
                            <TableRow key={report.id}>
                              <TableCell>{format(new Date(report.log_date), 'MMM d, yyyy')}</TableCell>
                              <TableCell>
                                {report.profiles?.first_name} {report.profiles?.last_name}
                              </TableCell>
                              <TableCell>{report.parcels_delivered || 0}</TableCell>
                              <TableCell>{report.cover_parcels || 0}</TableCell>
                              <TableCell>
                                <Badge variant={report.status === 'approved' ? 'default' : 'secondary'}>
                                  {report.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {report.screenshot_url ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => viewScreenshot(report.screenshot_url)}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                ) : (
                                  <span className="text-muted-foreground">No screenshot</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setSelectedReport(report)}
                                >
                                  View Details
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="sod" className="space-y-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>Start of Day Reports</CardTitle>
                      <CardDescription>
                        {format(startDate, 'MMM d, yyyy')} {dateRange !== 'daily' && `- ${format(endDate, 'MMM d, yyyy')}`}
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => exportToCSV(filteredSodReports, 'sod')}
                      className="flex items-center"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export CSV
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {sodLoading ? (
                      <div className="text-center py-8">Loading reports...</div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Driver</TableHead>
                            <TableHead>Round Number</TableHead>
                            <TableHead>Total Deliveries</TableHead>
                            <TableHead>Total Collections</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Screenshot</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredSodReports.map((report) => (
                            <TableRow key={report.id}>
                              <TableCell>{format(new Date(report.submitted_at), 'MMM d, yyyy')}</TableCell>
                              <TableCell>
                                {report.profiles?.first_name} {report.profiles?.last_name}
                              </TableCell>
                              <TableCell>{report.round_number || '-'}</TableCell>
                              <TableCell>{report.total_deliveries || 0}</TableCell>
                              <TableCell>{report.total_collections || 0}</TableCell>
                              <TableCell>
                                <Badge variant={report.processing_status === 'completed' ? 'default' : 'secondary'}>
                                  {report.processing_status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {report.screenshot_url ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => viewScreenshot(report.screenshot_url)}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                ) : (
                                  <span className="text-muted-foreground">No screenshot</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setSelectedReport(report)}
                                >
                                  View Details
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </main>
        </SidebarInset>
      </div>

      {/* Image Modal */}
      <Dialog open={imageModalOpen} onOpenChange={setImageModalOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Screenshot</DialogTitle>
          </DialogHeader>
          {selectedImage && (
            <img src={selectedImage} alt="Report Screenshot" className="w-full h-auto rounded-lg" />
          )}
        </DialogContent>
      </Dialog>

      {/* Report Details Modal */}
      <Dialog open={!!selectedReport} onOpenChange={() => setSelectedReport(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Report Details</DialogTitle>
          </DialogHeader>
          {selectedReport && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Driver</Label>
                  <p className="text-sm">{selectedReport.profiles?.first_name} {selectedReport.profiles?.last_name}</p>
                </div>
                <div>
                  <Label>Date</Label>
                  <p className="text-sm">
                    {format(new Date(selectedReport.log_date || selectedReport.submitted_at), 'MMM d, yyyy')}
                  </p>
                </div>
              </div>
              {selectedReport.parcels_delivered !== undefined ? (
                // EOD Report
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Parcels Delivered</Label>
                    <p className="text-sm">{selectedReport.parcels_delivered}</p>
                  </div>
                  <div>
                    <Label>Cover Parcels</Label>
                    <p className="text-sm">{selectedReport.cover_parcels || 0}</p>
                  </div>
                </div>
              ) : (
                // SOD Report
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Round Number</Label>
                    <p className="text-sm">{selectedReport.round_number}</p>
                  </div>
                  <div>
                    <Label>Total Deliveries</Label>
                    <p className="text-sm">{selectedReport.total_deliveries}</p>
                  </div>
                  <div>
                    <Label>Total Collections</Label>
                    <p className="text-sm">{selectedReport.total_collections}</p>
                  </div>
                  <div>
                    <Label>Manifest Date</Label>
                    <p className="text-sm">
                      {selectedReport.manifest_date ? format(new Date(selectedReport.manifest_date), 'MMM d, yyyy') : 'Not specified'}
                    </p>
                  </div>
                </div>
              )}
              {selectedReport.admin_notes && (
                <div>
                  <Label>Admin Notes</Label>
                  <p className="text-sm">{selectedReport.admin_notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
};

export default AdminReports;