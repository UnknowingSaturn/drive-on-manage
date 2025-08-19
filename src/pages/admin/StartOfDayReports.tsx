import React, { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Package, Eye, Search, Filter, Download, Calendar, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle, X, Edit, FileText } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfDay, endOfDay, addDays, subDays, parseISO, isToday, differenceInDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addWeeks, subWeeks, addMonths, subMonths } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface ValidationIssue {
  type: 'round_mismatch' | 'date_mismatch';
  severity: 'warning' | 'error';
  message: string;
}

interface ValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
}

type ViewType = 'daily' | 'weekly' | 'monthly';

const StartOfDayReports = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDriver, setSelectedDriver] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [previewImage, setPreviewImage] = useState<string>('');
  const [validationDialogOpen, setValidationDialogOpen] = useState(false);
  const [selectedReportValidation, setSelectedReportValidation] = useState<any>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<any>(null);
  const [viewType, setViewType] = useState<ViewType>('daily');
  
  // Calculate date range based on view type
  const getDateRange = () => {
    switch (viewType) {
      case 'weekly':
        return {
          start: startOfWeek(currentDate, { weekStartsOn: 1 }),
          end: endOfWeek(currentDate, { weekStartsOn: 1 })
        };
      case 'monthly':
        return {
          start: startOfMonth(currentDate),
          end: endOfMonth(currentDate)
        };
      default:
        return { start: currentDate, end: currentDate };
    }
  };

  const dateRange = getDateRange();
  const dayStart = startOfDay(dateRange.start);
  const dayEnd = endOfDay(dateRange.end);

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
        .from('driver_profiles')
        .select(`
          id,
          profiles!inner(
            first_name,
            last_name,
            email
          )
        `)
        .in('company_id', companyIds);

      if (error) throw error;
      return data?.map(driver => ({
        id: driver.id,
        first_name: driver.profiles.first_name,
        last_name: driver.profiles.last_name,
        email: driver.profiles.email
      })) || [];
    },
    enabled: companyIds.length > 0
  });

  // Get SOD reports with filters
  const { data: reports, isLoading } = useQuery({
    queryKey: ['sod-reports', companyIds, dayStart.toISOString(), dayEnd.toISOString(), selectedDriver, searchQuery, viewType],
    queryFn: async () => {
      if (companyIds.length === 0) return [];

      let query = supabase
        .from('start_of_day_reports')
        .select('*')
        .in('company_id', companyIds)
        .gte('created_at', dayStart.toISOString())
        .lte('created_at', dayEnd.toISOString())
        .order('created_at', { ascending: false });

      if (selectedDriver && selectedDriver !== 'all') {
        query = query.eq('driver_id', selectedDriver);
      }

      const { data: reportsData, error: reportsError } = await query;
      
      if (reportsError) {
        console.error('Error fetching SOD reports:', reportsError);
        throw reportsError;
      }

      if (!reportsData || reportsData.length === 0) {
        return [];
      }

      // Apply search filter on client side
      let filteredData = reportsData;
      if (searchQuery) {
        const searchLower = searchQuery.toLowerCase();
        filteredData = filteredData.filter(report => 
          report.driver_name.toLowerCase().includes(searchLower) ||
          report.round_number.toLowerCase().includes(searchLower) ||
          (report.extracted_round_number && report.extracted_round_number.toLowerCase().includes(searchLower))
        );
      }

      return filteredData;
    },
    enabled: companyIds.length > 0
  });

  // Validation logic
  const validateReport = (report: any): ValidationResult => {
    const issues: ValidationIssue[] = [];
    
    // Check round similarity
    if (report.round_number && report.extracted_round_number) {
      const selected = report.round_number.toLowerCase().trim();
      const detected = report.extracted_round_number.toLowerCase().trim();
      
      // Simple similarity check - exact match or substring match
      const isExactMatch = selected === detected;
      const isSubstringMatch = selected.includes(detected) || detected.includes(selected);
      
      if (!isExactMatch && !isSubstringMatch) {
        issues.push({
          type: 'round_mismatch',
          severity: 'warning',
          message: `Selected round "${report.round_number}" doesn't match detected round "${report.extracted_round_number}"`
        });
      }
    }
    
    return {
      isValid: issues.length === 0,
      issues
    };
  };

  // Mark report as valid mutation
  const markAsValidMutation = useMutation({
    mutationFn: async (reportId: string) => {
      const { error } = await supabase
        .from('start_of_day_reports')
        .update({ 
          processing_status: 'completed',
          vision_api_response: {
            ...selectedReportValidation?.vision_api_response,
            validation_override: true,
            validation_override_date: new Date().toISOString()
          }
        })
        .eq('id', reportId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Report marked as valid",
        description: "The validation issues have been ignored and the report is now marked as valid.",
      });
      queryClient.invalidateQueries({ queryKey: ['sod-reports'] });
      setValidationDialogOpen(false);
    }
  });

  // Update report mutation
  const updateReportMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase
        .from('start_of_day_reports')
        .update({
          driver_name: data.driver_name,
          round_number: data.round_number,
          extracted_round_number: data.extracted_round_number,
          heavy_parcels: parseInt(data.heavy_parcels) || 0,
          standard: parseInt(data.standard) || 0,
          hanging_garments: parseInt(data.hanging_garments) || 0,
          packets: parseInt(data.packets) || 0,
          small_packets: parseInt(data.small_packets) || 0,
          postables: parseInt(data.postables) || 0,
          processing_status: data.processing_status
        })
        .eq('id', data.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Report updated successfully",
        description: "The SOD report has been updated.",
      });
      queryClient.invalidateQueries({ queryKey: ['sod-reports'] });
      setEditDialogOpen(false);
      setEditingReport(null);
    }
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

  const getValidationBadge = (report: any) => {
    const validation = validateReport(report);
    
    if (validation.isValid) {
      return (
        <Button variant="ghost" size="sm" className="text-green-600">
          <CheckCircle className="h-4 w-4 mr-1" />
          Valid
        </Button>
      );
    }
    
    const hasErrors = validation.issues.some(issue => issue.severity === 'error');
    
    return (
      <Button 
        variant="ghost" 
        size="sm" 
        className={hasErrors ? "text-red-600" : "text-yellow-600"}
        onClick={() => {
          setSelectedReportValidation(report);
          setValidationDialogOpen(true);
        }}
      >
        <AlertTriangle className="h-4 w-4 mr-1" />
        {hasErrors ? 'Invalid' : 'Warning'}
      </Button>
    );
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

  const exportToCSV = () => {
    if (!reports || reports.length === 0) return;

    const csvData = reports.map(report => ({
      Date: format(new Date(report.created_at), 'yyyy-MM-dd HH:mm'),
      Driver: report.driver_name,
      'Selected Round': report.round_number,
      'Detected Round': report.extracted_round_number || '',
      'Heavy Parcels': report.heavy_parcels || 0,
      'Standard': report.standard || 0,
      'Hanging Garments': report.hanging_garments || 0,
      'Packets': report.packets || 0,
      'Small Packets': report.small_packets || 0,
      'Postables': report.postables || 0,
      'Total Deliveries': report.total_deliveries || 0,
      'Total Collections': report.total_collections || 0,
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
    link.download = `sod-reports-${viewType}-${format(currentDate, 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportToPDF = () => {
    if (!reports || reports.length === 0) return;

    const doc = new jsPDF();
    
    // Title
    const title = `Start of Day Reports - ${viewType.charAt(0).toUpperCase() + viewType.slice(1)} View`;
    doc.setFontSize(16);
    doc.text(title, 14, 20);
    
    // Date range
    const dateText = viewType === 'daily' 
      ? format(currentDate, 'dd/MM/yyyy')
      : `${format(dateRange.start, 'dd/MM/yyyy')} - ${format(dateRange.end, 'dd/MM/yyyy')}`;
    doc.setFontSize(12);
    doc.text(`Period: ${dateText}`, 14, 30);
    
    // Table data
    const tableData = reports.map(report => [
      format(new Date(report.created_at), 'dd/MM/yyyy HH:mm'),
      report.driver_name,
      report.round_number,
      report.extracted_round_number || '',
      (report.heavy_parcels || 0).toString(),
      (report.standard || 0).toString(),
      (report.total_deliveries || 0).toString(),
      (report.total_collections || 0).toString(),
      report.processing_status
    ]);

    (doc as any).autoTable({
      head: [['Date', 'Driver', 'Round', 'Detected', 'Heavy', 'Standard', 'Total Deliveries', 'Total Collections', 'Status']],
      body: tableData,
      startY: 40,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] }
    });
    
    doc.save(`sod-reports-${viewType}-${format(currentDate, 'yyyy-MM-dd')}.pdf`);
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
                  <p className="text-xs md:text-sm text-muted-foreground">Daily view of driver manifest uploads</p>
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
                <Button variant="outline" size="sm" onClick={() => navigateDate('prev')}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="px-4 py-2 bg-muted rounded-md min-w-[200px] text-center">
                  <span className="font-medium">
                    {viewType === 'daily' && format(currentDate, 'EEEE, dd MMM yyyy')}
                    {viewType === 'weekly' && `Week of ${format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'dd MMM')} - ${format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'dd MMM yyyy')}`}
                    {viewType === 'monthly' && format(currentDate, 'MMMM yyyy')}
                  </span>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigateDate('next')}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button onClick={exportToCSV} variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
                <Button onClick={exportToPDF} variant="outline" size="sm">
                  <FileText className="h-4 w-4 mr-2" />
                  Export PDF
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
                  {viewType === 'daily' && `Reports for ${format(currentDate, 'EEEE, dd MMM yyyy')}`}
                  {viewType === 'weekly' && `Reports for week of ${format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'dd MMM')} - ${format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'dd MMM yyyy')}`}
                  {viewType === 'monthly' && `Reports for ${format(currentDate, 'MMMM yyyy')}`}
                  <br />Total reports: {reports?.length || 0}
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
                           <TableHead>Driver</TableHead>
                           <TableHead>Selected Round</TableHead>
                           <TableHead>Detected Round</TableHead>
                           <TableHead>Date</TableHead>
                           <TableHead>Collections</TableHead>
                           <TableHead>Deliveries</TableHead>
                           <TableHead>Heavy</TableHead>
                           <TableHead>Standard</TableHead>
                           <TableHead>Hanging</TableHead>
                           <TableHead>Packets</TableHead>
                           <TableHead>Small</TableHead>
                           <TableHead>Postables</TableHead>
                           <TableHead>Status</TableHead>
                           <TableHead>Validation</TableHead>
                           <TableHead>Actions</TableHead>
                         </TableRow>
                       </TableHeader>
                      <TableBody>
                         {reports.map((report) => (
                           <TableRow key={report.id}>
                             <TableCell>
                               <div className="font-medium">{report.driver_name}</div>
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
                             <TableCell className="text-center">
                               {format(new Date(report.created_at), 'yyyy-MM-dd')}
                             </TableCell>
                             <TableCell className="text-center">{report.total_collections || 0}</TableCell>
                             <TableCell className="text-center">{report.total_deliveries || 0}</TableCell>
                            <TableCell className="text-center">{report.heavy_parcels || 0}</TableCell>
                            <TableCell className="text-center">{report.standard || 0}</TableCell>
                            <TableCell className="text-center">{report.hanging_garments || 0}</TableCell>
                            <TableCell className="text-center">{report.packets || 0}</TableCell>
                            <TableCell className="text-center">{report.small_packets || 0}</TableCell>
                             <TableCell className="text-center">{report.postables || 0}</TableCell>
                             <TableCell>{getStatusBadge(report.processing_status)}</TableCell>
                             <TableCell>{getValidationBadge(report)}</TableCell>
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
                                      <DialogTitle>Manifest Screenshot - {report.driver_name}</DialogTitle>
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

       {/* Validation Details Dialog */}
       <Dialog open={validationDialogOpen} onOpenChange={setValidationDialogOpen}>
         <DialogContent className="max-w-2xl">
           <DialogHeader>
             <DialogTitle className="flex items-center">
               <AlertTriangle className="h-5 w-5 text-yellow-600 mr-2" />
               Validation Issues - {selectedReportValidation?.driver_name}
             </DialogTitle>
           </DialogHeader>
           
           {selectedReportValidation && (
             <div className="space-y-6">
               {/* Report Summary */}
               <div className="bg-muted/50 p-4 rounded-lg">
                 <h4 className="font-semibold mb-2">Report Details</h4>
                 <div className="grid grid-cols-2 gap-4 text-sm">
                   <div>
                     <span className="text-muted-foreground">Selected Round:</span>
                     <Badge variant="outline" className="ml-2">{selectedReportValidation.round_number}</Badge>
                   </div>
                   <div>
                     <span className="text-muted-foreground">Detected Round:</span>
                     {selectedReportValidation.extracted_round_number ? (
                       <Badge variant="secondary" className="ml-2">{selectedReportValidation.extracted_round_number}</Badge>
                     ) : (
                       <span className="text-muted-foreground ml-2">Not detected</span>
                     )}
                   </div>
                 </div>
               </div>

               {/* Validation Issues */}
               <div>
                 <h4 className="font-semibold mb-3">Validation Issues</h4>
                 <div className="space-y-3">
                   {validateReport(selectedReportValidation).issues.map((issue, index) => (
                     <div key={index} className={`p-3 rounded-lg border ${
                       issue.severity === 'error' 
                         ? 'border-red-200 bg-red-50' 
                         : 'border-yellow-200 bg-yellow-50'
                     }`}>
                       <div className="flex items-center mb-1">
                         <AlertTriangle className={`h-4 w-4 mr-2 ${
                           issue.severity === 'error' ? 'text-red-600' : 'text-yellow-600'
                         }`} />
                         <span className={`font-medium ${
                           issue.severity === 'error' ? 'text-red-800' : 'text-yellow-800'
                         }`}>
                           {issue.severity === 'error' ? 'Error' : 'Warning'}
                         </span>
                       </div>
                       <p className={`text-sm ${
                         issue.severity === 'error' ? 'text-red-700' : 'text-yellow-700'
                       }`}>
                         {issue.message}
                       </p>
                     </div>
                   ))}
                 </div>
               </div>
             </div>
           )}

           <DialogFooter className="flex justify-between">
             <Button variant="outline" onClick={() => setValidationDialogOpen(false)}>
               Cancel
             </Button>
             <div className="space-x-2">
                <Button 
                  variant="outline"
                  onClick={() => {
                    setEditingReport(selectedReportValidation);
                    setEditDialogOpen(true);
                  }}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Details
                </Button>
               <Button 
                 onClick={() => markAsValidMutation.mutate(selectedReportValidation?.id)}
                 disabled={markAsValidMutation.isPending}
               >
                 <CheckCircle className="h-4 w-4 mr-2" />
                 {markAsValidMutation.isPending ? 'Ignoring...' : 'Ignore & Mark Valid'}
               </Button>
             </div>
           </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Report Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center">
                <Edit className="h-5 w-5 text-primary mr-2" />
                Edit SOD Report - {editingReport?.driver_name}
              </DialogTitle>
              <DialogDescription>
                Edit the details of this Start of Day report
              </DialogDescription>
            </DialogHeader>
            
            {editingReport && (
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.target as HTMLFormElement);
                const data = Object.fromEntries(formData.entries());
                updateReportMutation.mutate({ ...data, id: editingReport.id });
              }}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Driver Information */}
                  <div className="space-y-4">
                    <h4 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Driver Information</h4>
                    <div className="space-y-2">
                      <Label htmlFor="driver_name">Driver Name</Label>
                      <Input
                        id="driver_name"
                        name="driver_name"
                        defaultValue={editingReport.driver_name}
                        required
                      />
                    </div>
                  </div>

                  {/* Round Information */}
                  <div className="space-y-4">
                    <h4 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Round Information</h4>
                    <div className="space-y-2">
                      <Label htmlFor="round_number">Selected Round</Label>
                      <Input
                        id="round_number"
                        name="round_number"
                        defaultValue={editingReport.round_number}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="extracted_round_number">Detected Round</Label>
                      <Input
                        id="extracted_round_number"
                        name="extracted_round_number"
                        defaultValue={editingReport.extracted_round_number || ''}
                      />
                    </div>
                  </div>

                  {/* Parcel Counts */}
                  <div className="space-y-4">
                    <h4 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Parcel Types</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="heavy_parcels">Heavy Parcels</Label>
                        <Input
                          id="heavy_parcels"
                          name="heavy_parcels"
                          type="number"
                          min="0"
                          defaultValue={editingReport.heavy_parcels || 0}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="standard">Standard</Label>
                        <Input
                          id="standard"
                          name="standard"
                          type="number"
                          min="0"
                          defaultValue={editingReport.standard || 0}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="hanging_garments">Hanging Garments</Label>
                        <Input
                          id="hanging_garments"
                          name="hanging_garments"
                          type="number"
                          min="0"
                          defaultValue={editingReport.hanging_garments || 0}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="packets">Packets</Label>
                        <Input
                          id="packets"
                          name="packets"
                          type="number"
                          min="0"
                          defaultValue={editingReport.packets || 0}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="small_packets">Small Packets</Label>
                        <Input
                          id="small_packets"
                          name="small_packets"
                          type="number"
                          min="0"
                          defaultValue={editingReport.small_packets || 0}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="postables">Postables</Label>
                        <Input
                          id="postables"
                          name="postables"
                          type="number"
                          min="0"
                          defaultValue={editingReport.postables || 0}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Status */}
                  <div className="space-y-4">
                    <h4 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Status</h4>
                    <div className="space-y-2">
                      <Label htmlFor="processing_status">Processing Status</Label>
                      <Select name="processing_status" defaultValue={editingReport.processing_status}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="processing">Processing</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="failed">Failed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <DialogFooter className="mt-6">
                  <Button variant="outline" type="button" onClick={() => setEditDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={updateReportMutation.isPending}>
                    {updateReportMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </SidebarProvider>
    );
  };
  
  export default StartOfDayReports;