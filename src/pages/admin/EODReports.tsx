import React, { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Download, FileText, Search, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { format, addDays, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addWeeks, subWeeks, addMonths, subMonths } from 'date-fns';
import { Label } from '@/components/ui/label';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

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
  total_parcels?: number;
  processing_status?: string;
  app_screenshot?: string;
  vision_api_response?: any;
  driver_profiles: {
    id: string;
    profiles: {
      first_name: string;
      last_name: string;
      email: string;
    };
  };
}

type ViewType = 'daily' | 'weekly' | 'monthly';

const EODReports = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDriver, setSelectedDriver] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [viewType, setViewType] = useState<ViewType>('daily');

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

  // Calculate date range based on view type
  const getDateRange = () => {
    switch (viewType) {
      case 'weekly':
        return {
          start: format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
          end: format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'yyyy-MM-dd')
        };
      case 'monthly':
        return {
          start: format(startOfMonth(currentDate), 'yyyy-MM-dd'),
          end: format(endOfMonth(currentDate), 'yyyy-MM-dd')
        };
      default:
        const dateStr = format(currentDate, 'yyyy-MM-dd');
        return { start: dateStr, end: dateStr };
    }
  };

  const dateRange = getDateRange();

  // Fetch EOD reports for the current date range
  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['eod-reports', profile?.company_id, dateRange.start, dateRange.end, selectedDriver, viewType],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      
      let query = supabase
        .from('end_of_day_reports')
        .select(`
          *,
          driver_profiles!inner(
            id,
            user_id,
            company_id,
            profiles!inner(first_name, last_name, email)
          )
        `);

      // Filter by company via driver_profiles relationship and add date filters
      query = query.eq('driver_profiles.company_id', profile.company_id);

      if (viewType === 'daily') {
        query = query
          .gte('submitted_at', `${dateRange.start}T00:00:00`)
          .lte('submitted_at', `${dateRange.start}T23:59:59`);
      } else {
        query = query
          .gte('submitted_at', `${dateRange.start}T00:00:00`)
          .lte('submitted_at', `${dateRange.end}T23:59:59`);
      }

      if (selectedDriver !== 'all') {
        query = query.eq('driver_id', selectedDriver);
      }

      query = query.order('submitted_at', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.company_id
  });

  // Filter reports based on search term
  const filteredReports = useMemo(() => {
    if (!searchTerm) return reports;
    
    return reports.filter((report) => {
      const driverName = `${report.driver_profiles.profiles.first_name} ${report.driver_profiles.profiles.last_name}`.toLowerCase();
      const driverEmail = report.driver_profiles.profiles.email.toLowerCase();
      const vanReg = report.van_registration?.toLowerCase() || '';
      const search = searchTerm.toLowerCase();
      
      return driverName.includes(search) || 
             driverEmail.includes(search) || 
             vanReg.includes(search) ||
             report.round_1_number?.toLowerCase().includes(search) ||
             report.round_2_number?.toLowerCase().includes(search) ||
             report.round_3_number?.toLowerCase().includes(search) ||
             report.round_4_number?.toLowerCase().includes(search);
    });
  }, [reports, searchTerm]);

  const navigateDate = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      switch (viewType) {
        case 'weekly':
          setCurrentDate(prev => subWeeks(prev, 1));
          break;
        case 'monthly':
          setCurrentDate(prev => subMonths(prev, 1));
          break;
        default:
          setCurrentDate(prev => subDays(prev, 1));
      }
    } else {
      switch (viewType) {
        case 'weekly':
          setCurrentDate(prev => addWeeks(prev, 1));
          break;
        case 'monthly':
          setCurrentDate(prev => addMonths(prev, 1));
          break;
        default:
          setCurrentDate(prev => addDays(prev, 1));
      }
    }
  };

  const handleExportCSV = () => {
    const csvData = filteredReports.map(report => ({
      'Date': format(new Date(report.submitted_at), 'dd/MM/yyyy HH:mm'),
      'Driver': `${report.driver_profiles.profiles.first_name} ${report.driver_profiles.profiles.last_name}`,
      'Email': report.driver_profiles.profiles.email,
      'Van Registration': report.van_registration || 'N/A',
      'Total Parcels': report.total_parcels || 0,
      'Successful Deliveries': report.successful_deliveries,
      'Successful Collections': report.successful_collections,
      'Did Support': report.did_support ? 'Yes' : 'No',
      'Support Parcels': report.support_parcels,
      'Has Company Van': report.has_company_van ? 'Yes' : 'No',
      'Processing Status': report.processing_status,
      'Round 1': report.round_1_number || '',
      'Round 2': report.round_2_number || '',
      'Round 3': report.round_3_number || '',
      'Round 4': report.round_4_number || ''
    }));

    const csv = [
      Object.keys(csvData[0] || {}).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eod-reports-${viewType}-${format(currentDate, 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    
    // Title
    const title = `EOD Reports - ${viewType.charAt(0).toUpperCase() + viewType.slice(1)} View`;
    doc.setFontSize(16);
    doc.text(title, 14, 20);
    
    // Date range
    const dateText = viewType === 'daily' 
      ? format(currentDate, 'dd/MM/yyyy')
      : `${format(new Date(dateRange.start), 'dd/MM/yyyy')} - ${format(new Date(dateRange.end), 'dd/MM/yyyy')}`;
    doc.setFontSize(12);
    doc.text(`Period: ${dateText}`, 14, 30);
    
    // Table data
    const tableData = filteredReports.map(report => [
      format(new Date(report.submitted_at), 'dd/MM/yyyy HH:mm'),
      `${report.driver_profiles.profiles.first_name} ${report.driver_profiles.profiles.last_name}`,
      report.van_registration || 'N/A',
      report.total_parcels?.toString() || '0',
      report.successful_deliveries.toString(),
      report.successful_collections.toString(),
      report.did_support ? 'Yes' : 'No',
      report.support_parcels.toString(),
      report.processing_status
    ]);

    (doc as any).autoTable({
      head: [['Date', 'Driver', 'Van Reg', 'Total', 'Deliveries', 'Collections', 'Support', 'Support #', 'Status']],
      body: tableData,
      startY: 40,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] }
    });
    
    doc.save(`eod-reports-${viewType}-${format(currentDate, 'yyyy-MM-dd')}.pdf`);
  };

  const viewScreenshot = async (screenshotPath: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('eod-screenshots')
        .createSignedUrl(screenshotPath, 3600);

      if (error) throw error;
      
      if (data?.signedUrl) {
        setImagePreview(data.signedUrl);
      }
    } catch (error: any) {
      toast({
        title: "Error loading screenshot",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-background">
          <AppSidebar />
          <SidebarInset className="flex-1">
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p>Loading EOD reports...</p>
              </div>
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        
        <SidebarInset className="flex-1">
          <header className="border-b bg-card sticky top-0 z-10">
            <div className="flex items-center justify-between px-4 py-4">
              <div className="flex items-center">
                <SidebarTrigger className="mr-4" />
                <div>
                  <h1 className="text-xl font-semibold text-foreground">End of Day Reports</h1>
                  <p className="text-sm text-muted-foreground">View and manage driver EOD submissions</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Select value={viewType} onValueChange={(value: ViewType) => setViewType(value)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigateDate('prev')}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="px-4 py-2 bg-muted rounded-md min-w-[200px] text-center">
                  <span className="font-medium">
                    {viewType === 'daily' && format(currentDate, 'EEEE, dd MMM yyyy')}
                    {viewType === 'weekly' && `Week of ${format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'dd MMM')} - ${format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'dd MMM yyyy')}`}
                    {viewType === 'monthly' && format(currentDate, 'MMMM yyyy')}
                  </span>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigateDate('next')}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button onClick={handleExportCSV} variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
                <Button onClick={handleExportPDF} variant="outline" size="sm">
                  <FileText className="h-4 w-4 mr-2" />
                  Export PDF
                </Button>
              </div>
            </div>
          </header>

          <main className="p-6 space-y-6">
            {/* Filters */}
            <Card>
              <CardHeader>
                <CardTitle>Filters</CardTitle>
                <CardDescription>Filter and search EOD reports</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="driver-select">Driver</Label>
                    <Select value={selectedDriver} onValueChange={setSelectedDriver}>
                      <SelectTrigger id="driver-select">
                        <SelectValue placeholder="All drivers" />
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
                  <div className="space-y-2">
                    <Label htmlFor="search">Search</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="search"
                        placeholder="Search by driver, email, van reg, or round..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Reports Table */}
            <Card>
              <CardHeader>
                <CardTitle>EOD Reports ({filteredReports.length})</CardTitle>
                <CardDescription>
                  {viewType === 'daily' && `Reports for ${format(currentDate, 'EEEE, dd MMM yyyy')}`}
                  {viewType === 'weekly' && `Reports for week of ${format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'dd MMM')} - ${format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'dd MMM yyyy')}`}
                  {viewType === 'monthly' && `Reports for ${format(currentDate, 'MMMM yyyy')}`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {filteredReports.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No EOD reports found for this period.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Driver</TableHead>
                        <TableHead>Van Reg</TableHead>
                        <TableHead>Total Parcels</TableHead>
                        <TableHead>Deliveries</TableHead>
                        <TableHead>Collections</TableHead>
                        <TableHead>Support</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredReports.map((report) => (
                        <TableRow key={report.id}>
                          <TableCell>
                            {format(new Date(report.submitted_at), 'HH:mm')}
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {report.driver_profiles.profiles.first_name} {report.driver_profiles.profiles.last_name}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {report.driver_profiles.profiles.email}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{report.van_registration || 'N/A'}</TableCell>
                          <TableCell className="font-medium">{report.total_parcels || 0}</TableCell>
                          <TableCell>{report.successful_deliveries}</TableCell>
                          <TableCell>{report.successful_collections}</TableCell>
                          <TableCell>
                            {report.did_support ? (
                              <Badge variant="secondary">{report.support_parcels}</Badge>
                            ) : (
                              <Badge variant="outline">No</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={
                              report.processing_status === 'completed' ? 'default' :
                              report.processing_status === 'processing' ? 'secondary' :
                              'outline'
                            }>
                              {report.processing_status || 'pending'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {report.app_screenshot && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => viewScreenshot(report.app_screenshot!)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </main>
        </SidebarInset>
      </div>

      {/* Image Preview Dialog */}
      <Dialog open={!!imagePreview} onOpenChange={() => setImagePreview(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>EOD Screenshot</DialogTitle>
            <DialogDescription>Driver's end of day app screenshot</DialogDescription>
          </DialogHeader>
          {imagePreview && (
            <div className="flex justify-center">
              <img 
                src={imagePreview} 
                alt="EOD Screenshot" 
                className="max-w-full max-h-[70vh] object-contain rounded-lg"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
};

export default EODReports;