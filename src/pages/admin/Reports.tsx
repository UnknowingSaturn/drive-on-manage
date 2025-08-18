import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, Download, Calendar, Package, Clock, TrendingUp } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

const AdminReports = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  
  const [filterType, setFilterType] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedDriver, setSelectedDriver] = useState<string>('all');

  // Calculate date range based on filter type
  const getDateRange = () => {
    const date = new Date(selectedDate);
    switch (filterType) {
      case 'weekly':
        return {
          start: format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
          end: format(endOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd')
        };
      case 'monthly':
        return {
          start: format(startOfMonth(date), 'yyyy-MM-dd'),
          end: format(endOfMonth(date), 'yyyy-MM-dd')
        };
      default:
        return {
          start: selectedDate,
          end: selectedDate
        };
    }
  };

  const dateRange = getDateRange();

  // Fetch drivers for filter dropdown
  const { data: drivers } = useQuery({
    queryKey: ['drivers', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      const { data } = await supabase
        .from('driver_profiles')
        .select(`
          id,
          profiles!inner(first_name, last_name)
        `)
        .eq('company_id', profile.company_id);
      return data || [];
    },
    enabled: !!profile?.company_id
  });

  // Fetch EOD reports
  const { data: eodReports, isLoading: loadingEOD } = useQuery({
    queryKey: ['eod-reports', profile?.company_id, dateRange, selectedDriver],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      
      let query = supabase
        .from('end_of_day_reports')
        .select(`
          *,
          driver_profiles!inner(
            id,
            profiles!inner(first_name, last_name)
          )
        `)
        .eq('driver_profiles.company_id', profile.company_id)
        .gte('submitted_at', `${dateRange.start}T00:00:00.000Z`)
        .lte('submitted_at', `${dateRange.end}T23:59:59.999Z`)
        .order('submitted_at', { ascending: false });

      if (selectedDriver !== 'all') {
        query = query.eq('driver_id', selectedDriver);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.company_id
  });

  // Fetch SOD reports
  const { data: sodReports, isLoading: loadingSOD } = useQuery({
    queryKey: ['sod-reports', profile?.company_id, dateRange, selectedDriver],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      
      let query = supabase
        .from('start_of_day_reports')
        .select(`
          *,
          driver_profiles!inner(
            id,
            profiles!inner(first_name, last_name)
          )
        `)
        .eq('company_id', profile.company_id)
        .gte('submitted_at', `${dateRange.start}T00:00:00.000Z`)
        .lte('submitted_at', `${dateRange.end}T23:59:59.999Z`)
        .order('submitted_at', { ascending: false });

      if (selectedDriver !== 'all') {
        query = query.eq('driver_id', selectedDriver);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.company_id
  });

  const exportToCsv = (data: any[], type: 'eod' | 'sod') => {
    if (!data.length) {
      toast({
        title: "No data to export",
        description: "There are no reports for the selected period.",
        variant: "destructive"
      });
      return;
    }

    const headers = type === 'eod' 
      ? ['Date', 'Driver', 'Deliveries', 'Collections', 'Support Work', 'Support Parcels', 'Status']
      : ['Date', 'Driver', 'Round Number', 'Total Deliveries', 'Total Collections', 'Standard', 'Packets', 'Status'];
    
    const csvContent = [
      headers.join(','),
      ...data.map(report => {
        const driverName = `${report.driver_profiles.profiles.first_name} ${report.driver_profiles.profiles.last_name}`;
        const date = format(new Date(report.submitted_at), 'yyyy-MM-dd HH:mm');
        
        if (type === 'eod') {
          return [
            date,
            `"${driverName}"`,
            report.successful_deliveries || 0,
            report.successful_collections || 0,
            report.did_support ? 'Yes' : 'No',
            report.support_parcels || 0,
            report.processing_status || 'pending'
          ].join(',');
        } else {
          return [
            date,
            `"${driverName}"`,
            `"${report.round_number || 'N/A'}"`,
            report.total_deliveries || 0,
            report.total_collections || 0,
            report.standard || 0,
            report.packets || 0,
            report.processing_status || 'pending'
          ].join(',');
        }
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type.toUpperCase()}_reports_${dateRange.start}_to_${dateRange.end}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast({
      title: "Export successful",
      description: `${type.toUpperCase()} reports have been exported to CSV.`
    });
  };

  const getFilterLabel = () => {
    switch (filterType) {
      case 'weekly':
        return `Week of ${format(new Date(selectedDate), 'MMM dd, yyyy')}`;
      case 'monthly':
        return `${format(new Date(selectedDate), 'MMMM yyyy')}`;
      default:
        return format(new Date(selectedDate), 'MMM dd, yyyy');
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
                <p className="text-sm text-muted-foreground">View and manage driver reports</p>
              </div>
            </div>
          </header>

          <main className="p-6 space-y-6">
            {/* Filters */}
            <Card className="logistics-card">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Calendar className="h-5 w-5 mr-2" />
                  Report Filters
                </CardTitle>
                <CardDescription>
                  Filter reports by date range and driver
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="filter-type">Period Type</Label>
                    <Select value={filterType} onValueChange={(value: 'daily' | 'weekly' | 'monthly') => setFilterType(value)}>
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
                    <Label htmlFor="date">Date</Label>
                    <Input
                      id="date"
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="driver">Driver</Label>
                    <Select value={selectedDriver} onValueChange={setSelectedDriver}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Drivers</SelectItem>
                        {drivers?.map((driver) => (
                          <SelectItem key={driver.id} value={driver.id}>
                            {driver.profiles.first_name} {driver.profiles.last_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Period</Label>
                    <div className="text-sm bg-muted p-2 rounded">
                      {getFilterLabel()}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Tabs defaultValue="eod" className="space-y-6">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="eod" className="flex items-center">
                  <Package className="h-4 w-4 mr-2" />
                  End of Day Reports
                </TabsTrigger>
                <TabsTrigger value="sod" className="flex items-center">
                  <Clock className="h-4 w-4 mr-2" />
                  Start of Day Reports
                </TabsTrigger>
              </TabsList>

              <TabsContent value="eod" className="space-y-6">
                <Card className="logistics-card">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>End of Day Reports</CardTitle>
                        <CardDescription>
                          {eodReports?.length || 0} reports for {getFilterLabel()}
                        </CardDescription>
                      </div>
                      <Button
                        onClick={() => exportToCsv(eodReports || [], 'eod')}
                        variant="outline"
                        className="flex items-center"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Export CSV
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {loadingEOD ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                        <p>Loading reports...</p>
                      </div>
                    ) : !eodReports?.length ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No EOD reports found for this period</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Date/Time</TableHead>
                              <TableHead>Driver</TableHead>
                              <TableHead>Deliveries</TableHead>
                              <TableHead>Collections</TableHead>
                              <TableHead>Support Work</TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {eodReports.map((report) => (
                              <TableRow key={report.id}>
                                <TableCell>
                                  {format(new Date(report.submitted_at), 'MMM dd, HH:mm')}
                                </TableCell>
                                <TableCell>
                                  <div className="font-medium">
                                    {report.driver_profiles.profiles.first_name} {report.driver_profiles.profiles.last_name}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="text-center font-semibold text-lg">
                                    {report.successful_deliveries || 0}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="text-center font-semibold text-lg">
                                    {report.successful_collections || 0}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="text-center">
                                    {report.did_support ? (
                                      <Badge variant="default">
                                        {report.support_parcels || 0} parcels
                                      </Badge>
                                    ) : (
                                      <Badge variant="secondary">None</Badge>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant={
                                    report.processing_status === 'completed' ? 'default' :
                                    report.processing_status === 'error' ? 'destructive' : 'secondary'
                                  }>
                                    {report.processing_status || 'pending'}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="sod" className="space-y-6">
                <Card className="logistics-card">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Start of Day Reports</CardTitle>
                        <CardDescription>
                          {sodReports?.length || 0} reports for {getFilterLabel()}
                        </CardDescription>
                      </div>
                      <Button
                        onClick={() => exportToCsv(sodReports || [], 'sod')}
                        variant="outline"
                        className="flex items-center"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Export CSV
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {loadingSOD ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                        <p>Loading reports...</p>
                      </div>
                    ) : !sodReports?.length ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No SOD reports found for this period</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Date/Time</TableHead>
                              <TableHead>Driver</TableHead>
                              <TableHead>Round</TableHead>
                              <TableHead>Deliveries</TableHead>
                              <TableHead>Collections</TableHead>
                              <TableHead>Parcels</TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {sodReports.map((report) => (
                              <TableRow key={report.id}>
                                <TableCell>
                                  {format(new Date(report.submitted_at), 'MMM dd, HH:mm')}
                                </TableCell>
                                <TableCell>
                                  <div className="font-medium">
                                    {report.driver_profiles.profiles.first_name} {report.driver_profiles.profiles.last_name}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline">
                                    {report.round_number || 'N/A'}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <div className="text-center font-semibold text-lg">
                                    {report.total_deliveries || 0}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="text-center font-semibold text-lg">
                                    {report.total_collections || 0}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="text-center">
                                    <div className="text-sm">
                                      <div>Std: {report.standard || 0}</div>
                                      <div>Pkts: {report.packets || 0}</div>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant={
                                    report.processing_status === 'completed' ? 'default' :
                                    report.processing_status === 'error' ? 'destructive' : 'secondary'
                                  }>
                                    {report.processing_status || 'pending'}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default AdminReports;