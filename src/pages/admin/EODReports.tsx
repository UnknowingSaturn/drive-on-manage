import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Package, TrendingUp, Download, Calendar, DollarSign, CheckCircle, AlertCircle, Eye, Edit, Camera, FileText } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays, startOfWeek, endOfWeek } from 'date-fns';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { useToast } from '@/hooks/use-toast';

const EODReports = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [timeFilter, setTimeFilter] = useState('week');
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editData, setEditData] = useState({
    actual_pay: '',
    admin_notes: '',
    status: ''
  });

  // Fetch EOD reports with driver information
  const { data: eodReports, isLoading } = useQuery({
    queryKey: ['eod-reports', profile?.company_id, timeFilter],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      
      let dateFilter = new Date();
      switch (timeFilter) {
        case 'week':
          dateFilter = startOfWeek(new Date(), { weekStartsOn: 1 });
          break;
        case 'month':
          dateFilter = subDays(new Date(), 30);
          break;
        case 'today':
        default:
          dateFilter = new Date();
          break;
      }

      const { data: reports, error: reportsError } = await supabase
        .from('eod_reports')
        .select('*')
        .eq('company_id', profile.company_id)
        .gte('log_date', format(dateFilter, 'yyyy-MM-dd'))
        .order('log_date', { ascending: false });

      if (reportsError) throw reportsError;

      // Fetch driver profiles separately for better performance
      const { data: drivers } = await supabase
        .from('driver_profiles')
        .select('id, user_id')
        .in('id', reports?.map(r => r.driver_id) || []);

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name')
        .in('user_id', drivers?.map(d => d.user_id) || []);

      // Fetch van information
      const { data: vans } = await supabase
        .from('vans')
        .select('id, registration, make, model')
        .in('id', reports?.map(r => r.van_id).filter(Boolean) || []);

      return reports?.map(report => {
        const driver = drivers?.find(d => d.id === report.driver_id);
        const profile = profiles?.find(p => p.user_id === driver?.user_id);
        const van = vans?.find(v => v.id === report.van_id);
        
        return {
          ...report,
          driver_profile: profile,
          van: van
        };
      }) || [];
    },
    enabled: !!profile?.company_id
  });

  // Calculate summary statistics
  const totalParcelsDelivered = eodReports?.reduce((sum, report) => sum + (report.parcels_delivered || 0), 0) || 0;
  const totalEstimatedPay = eodReports?.reduce((sum, report) => sum + (report.estimated_pay || 0), 0) || 0;
  const totalActualPay = eodReports?.reduce((sum, report) => sum + (report.actual_pay || 0), 0) || 0;
  const avgDeliveryCount = eodReports?.length ? Math.round(totalParcelsDelivered / eodReports.length) : 0;

  // Update EOD report mutation
  const updateReportMutation = useMutation({
    mutationFn: async ({ reportId, updates }: { reportId: string, updates: any }) => {
      const { error } = await supabase
        .from('eod_reports')
        .update({
          actual_pay: updates.actual_pay ? parseFloat(updates.actual_pay) : null,
          admin_notes: updates.admin_notes || null,
          status: updates.status,
          approved_by: profile?.user_id,
          approved_at: new Date().toISOString()
        })
        .eq('id', reportId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Report updated",
        description: "EOD report has been successfully updated",
      });
      queryClient.invalidateQueries({ queryKey: ['eod-reports'] });
      setIsEditDialogOpen(false);
      setSelectedReport(null);
    },
    onError: (error) => {
      toast({
        title: "Error updating report",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const getStatusBadge = (report: any) => {
    switch (report.status) {
      case 'approved':
        return (
          <Badge className="bg-success text-success-foreground">
            <CheckCircle className="h-3 w-3 mr-1" />
            Approved
          </Badge>
        );
      case 'submitted':
        return (
          <Badge className="bg-warning text-warning-foreground">
            <AlertCircle className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            {report.status}
          </Badge>
        );
    }
  };

  const exportToCSV = () => {
    if (!eodReports?.length) return;

    const headers = [
      'Date',
      'Driver',
      'Van',
      'Parcels Delivered',
      'Estimated Pay',
      'Actual Pay',
      'Status',
      'Issues Reported'
    ];

    const csvData = eodReports.map(report => [
      format(new Date(report.log_date), 'dd/MM/yyyy'),
      `${report.driver_profile?.first_name || ''} ${report.driver_profile?.last_name || ''}`.trim() || 'Unknown',
      report.van ? `${report.van.registration} (${report.van.make} ${report.van.model})` : '-',
      report.parcels_delivered || 0,
      report.estimated_pay ? `£${report.estimated_pay}` : '£0.00',
      report.actual_pay ? `£${report.actual_pay}` : '-',
      report.status,
      report.issues_reported || '-'
    ]);

    const csv = [headers, ...csvData].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eod-reports-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleEditReport = (report: any) => {
    setSelectedReport(report);
    setEditData({
      actual_pay: report.actual_pay?.toString() || '',
      admin_notes: report.admin_notes || '',
      status: report.status || 'submitted'
    });
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (!selectedReport) return;
    updateReportMutation.mutate({
      reportId: selectedReport.id,
      updates: editData
    });
  };

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        
        <SidebarInset className="flex-1">
          <header className="border-b bg-card sticky top-0 z-10">
            <div className="flex items-center px-4 py-4">
              <SidebarTrigger className="mr-4" />
              <div>
                <h1 className="text-xl font-semibold text-foreground">EOD Reports & Finance</h1>
                <p className="text-sm text-muted-foreground">Track deliveries and financial performance</p>
              </div>
            </div>
          </header>

          <main className="p-6 space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold">Performance Analytics</h2>
                <p className="text-muted-foreground">End of day reports and financial tracking</p>
              </div>
        
        <div className="flex items-center space-x-4">
          <Select value={timeFilter} onValueChange={setTimeFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>
          
          <Button onClick={exportToCSV} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Delivered</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalParcelsDelivered}</div>
            <p className="text-xs text-muted-foreground">
              {timeFilter === 'today' ? 'Today' : timeFilter === 'week' ? 'This week' : 'Last 30 days'}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estimated Pay</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">£{totalEstimatedPay.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              Pending approval
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Actual Pay</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">£{totalActualPay.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              Approved amounts
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reports</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{eodReports?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              Avg: {avgDeliveryCount} parcels/day
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>End of Day Reports</CardTitle>
          <CardDescription>Driver EOD submissions with screenshots and delivery summaries</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead>Van</TableHead>
                <TableHead>Delivered</TableHead>
                <TableHead>Est. Pay</TableHead>
                <TableHead>Actual Pay</TableHead>
                <TableHead>Screenshot</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {eodReports?.map((report) => (
                <TableRow key={report.id}>
                  <TableCell className="font-medium">
                    {format(new Date(report.log_date), 'dd/MM/yyyy')}
                  </TableCell>
                  <TableCell>
                    {report.driver_profile?.first_name} {report.driver_profile?.last_name}
                  </TableCell>
                  <TableCell>
                    {report.van ? `${report.van.registration}` : '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <Package className="h-3 w-3 mr-1 text-muted-foreground" />
                      {report.parcels_delivered || 0}
                    </div>
                  </TableCell>
                  <TableCell>
                    £{report.estimated_pay?.toFixed(2) || '0.00'}
                  </TableCell>
                  <TableCell>
                    {report.actual_pay ? `£${report.actual_pay.toFixed(2)}` : '-'}
                  </TableCell>
                  <TableCell>
                    {report.screenshot_url ? (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Camera className="h-3 w-3 mr-1" />
                            View
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl">
                          <DialogHeader>
                            <DialogTitle>Delivery Screenshot</DialogTitle>
                          </DialogHeader>
                          <div className="mt-4">
                            <img 
                              src={supabase.storage.from('eod-screenshots').getPublicUrl(report.screenshot_url).data.publicUrl}
                              alt="Delivery summary screenshot"
                              className="w-full rounded-lg border"
                            />
                          </div>
                        </DialogContent>
                      </Dialog>
                    ) : (
                      <span className="text-muted-foreground text-sm">No screenshot</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(report)}
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Eye className="h-3 w-3 mr-1" />
                            View
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>EOD Report Details</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 mt-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label className="text-sm font-medium">Driver</Label>
                                <p>{report.driver_profile?.first_name} {report.driver_profile?.last_name}</p>
                              </div>
                              <div>
                                <Label className="text-sm font-medium">Date</Label>
                                <p>{format(new Date(report.log_date), 'dd/MM/yyyy')}</p>
                              </div>
                              <div>
                                <Label className="text-sm font-medium">Parcels Delivered</Label>
                                <p>{report.parcels_delivered}</p>
                              </div>
                              <div>
                                <Label className="text-sm font-medium">Estimated Pay</Label>
                                <p>£{report.estimated_pay?.toFixed(2)}</p>
                              </div>
                            </div>
                            
                            {report.issues_reported && (
                              <div>
                                <Label className="text-sm font-medium">Issues Reported</Label>
                                <p className="text-sm p-3 bg-muted rounded-lg mt-1">{report.issues_reported}</p>
                              </div>
                            )}
                            
                            {report.admin_notes && (
                              <div>
                                <Label className="text-sm font-medium">Admin Notes</Label>
                                <p className="text-sm p-3 bg-muted rounded-lg mt-1">{report.admin_notes}</p>
                              </div>
                            )}
                          </div>
                        </DialogContent>
                      </Dialog>
                      
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleEditReport(report)}
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {eodReports?.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No EOD reports found for the selected time period.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Report Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit EOD Report</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label htmlFor="actual_pay">Actual Pay (£)</Label>
              <Input
                id="actual_pay"
                type="number"
                step="0.01"
                value={editData.actual_pay}
                onChange={(e) => setEditData(prev => ({ ...prev, actual_pay: e.target.value }))}
                placeholder="Enter actual pay amount"
              />
            </div>
            
            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={editData.status} onValueChange={(value) => setEditData(prev => ({ ...prev, status: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="admin_notes">Admin Notes</Label>
              <Textarea
                id="admin_notes"
                value={editData.admin_notes}
                onChange={(e) => setEditData(prev => ({ ...prev, admin_notes: e.target.value }))}
                placeholder="Add any admin notes or comments..."
                rows={3}
              />
            </div>
            
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit} disabled={updateReportMutation.isPending}>
                {updateReportMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default EODReports;