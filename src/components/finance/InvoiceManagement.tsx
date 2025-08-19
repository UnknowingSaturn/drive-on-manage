import React, { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Download, FileText, Send, Plus, Eye, Mail, Package, DollarSign, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, subMonths, parse } from 'date-fns';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

export const InvoiceManagement = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedPeriod, setSelectedPeriod] = useState({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  });
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);

  // Fetch driver invoices for the selected period
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['driver-invoices', profile?.company_id, selectedPeriod],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      
      const { data, error } = await supabase
        .from('driver_invoices')
        .select('*')
        .eq('company_id', profile.company_id)
        .gte('billing_period_start', selectedPeriod.start)
        .lte('billing_period_end', selectedPeriod.end)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.company_id
  });

  // Fetch driver profiles separately for better performance
  const { data: driverProfiles = [] } = useQuery({
    queryKey: ['driver-profiles-finance', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      
      const { data, error } = await supabase
        .from('driver_profiles')
        .select(`
          id,
          profiles!inner(first_name, last_name, email)
        `)
        .eq('company_id', profile.company_id);

      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.company_id
  });

  // Fetch period metrics for financial overview
  const { data: periodMetrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['period-metrics', profile?.company_id, selectedPeriod],
    queryFn: async () => {
      if (!profile?.company_id) return null;
      
      // Query with type assertion to avoid TypeScript issues
      const eodQuery = await (supabase as any)
        .from('end_of_day_reports')
        .select('successful_deliveries, successful_collections, submitted_at')
        .eq('company_id', profile.company_id)
        .gte('submitted_at', selectedPeriod.start)
        .lte('submitted_at', selectedPeriod.end);
          
      if (eodQuery.error) throw eodQuery.error;
      const eodReports = eodQuery.data || [];

      // Get driver payments for the period
      const paymentsResult = await supabase
        .from('payments')
        .select('total_pay')
        .eq('company_id', profile.company_id)
        .gte('period_start', selectedPeriod.start)
        .lte('period_end', selectedPeriod.end);

      if (paymentsResult.error) throw paymentsResult.error;
      const payments = paymentsResult.data || [];

      // Get operating costs for the period
      const costsResult = await supabase
        .from('operating_costs')
        .select('amount, category')
        .eq('company_id', profile.company_id)
        .gte('date', selectedPeriod.start)
        .lte('date', selectedPeriod.end);

      if (costsResult.error) throw costsResult.error;
      const operatingCosts = costsResult.data || [];

      // Calculate metrics
      const totalParcels = eodReports.reduce((sum, report) => sum + (report.successful_deliveries + report.successful_collections), 0);
      const totalRevenue = eodReports.reduce((sum, report) => {
        // Estimate revenue based on parcel count * average rate (£0.50 default)
        return sum + ((report.successful_deliveries + report.successful_collections) * 0.50);
      }, 0);
      const totalWages = payments.reduce((sum, payment) => sum + payment.total_pay, 0);
      const totalOperatingCosts = operatingCosts.reduce((sum, cost) => sum + cost.amount, 0);
      const profitBeforeCosts = totalRevenue - totalWages;
      const profitAfterCosts = profitBeforeCosts - totalOperatingCosts;

      return {
        totalParcels,
        totalRevenue,
        totalWages,
        totalOperatingCosts,
        profitBeforeCosts,
        profitAfterCosts,
        operatingCosts
      };
    },
    enabled: !!profile?.company_id
  });

  // Generate invoices mutation
  const generateInvoicesMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.company_id) return;

      // Get approved EOD reports for the period
      const { data: eodReports, error: eodError } = await supabase
        .from('end_of_day_reports')
        .select('successful_deliveries, successful_collections, submitted_at, driver_id')
        .eq('company_id', profile.company_id)
        .gte('submitted_at', selectedPeriod.start)
        .lte('submitted_at', selectedPeriod.end);

      if (eodError) throw eodError;

      // Get driver profiles
      const { data: drivers, error: driversError } = await supabase
        .from('driver_profiles')
        .select('*')
        .eq('company_id', profile.company_id);

      if (driversError) throw driversError;

      // Group reports by driver and calculate totals
      const driverTotals = eodReports?.reduce((acc, report) => {
        if (!acc[report.driver_id]) {
          acc[report.driver_id] = { parcels: 0, reports: [] };
        }
        acc[report.driver_id].parcels += (report.successful_deliveries + report.successful_collections);
        acc[report.driver_id].reports.push(report);
        return acc;
      }, {} as Record<string, { parcels: number; reports: any[] }>);

      // Create invoices
      const invoicesToCreate = [];
      for (const [driverId, totals] of Object.entries(driverTotals || {})) {
        const driver = drivers?.find(d => d.id === driverId);
        if (!driver) continue;

        const { data: invoiceData, error: invoiceError } = await supabase
          .rpc('calculate_driver_invoice_data', {
            driver_id_param: driverId,
            period_start: selectedPeriod.start,
            period_end: selectedPeriod.end
          });

        if (invoiceError) throw invoiceError;

        const { data: invoiceNumber, error: numberError } = await supabase
          .rpc('generate_invoice_number');

        if (numberError) throw numberError;

        invoicesToCreate.push({
          invoice_number: invoiceNumber,
          driver_id: driverId,
          company_id: profile.company_id,
          billing_period_start: selectedPeriod.start,
          billing_period_end: selectedPeriod.end,
          total_parcels: invoiceData[0]?.total_parcels || 0,
          parcel_rate: invoiceData[0]?.parcel_rate || 0,
          total_amount: invoiceData[0]?.total_amount || 0,
          status: 'pending',
          generated_by: profile.user_id
        });
      }

      if (invoicesToCreate.length === 0) {
        throw new Error('No invoices to generate - no approved EOD reports found for this period');
      }

      const { error } = await supabase
        .from('driver_invoices')
        .insert(invoicesToCreate);

      if (error) throw error;

      return invoicesToCreate.length;
    },
    onSuccess: (count) => {
      toast({
        title: "Invoices generated successfully",
        description: `Created ${count} invoice${count !== 1 ? 's' : ''} for the selected period.`,
      });
      queryClient.invalidateQueries({ queryKey: ['driver-invoices'] });
      setIsGenerateDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error generating invoices",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Send invoices via email mutation
  const sendInvoicesMutation = useMutation({
    mutationFn: async () => {
      if (!invoices.length) throw new Error('No invoices to send');

      // Call edge function to send emails and create ZIP
      const { data, error } = await supabase.functions.invoke('send-invoices', {
        body: {
          invoices: invoices.map(inv => {
            const driver = driverProfiles.find(d => d.id === inv.driver_id);
            return {
              id: inv.id,
              invoice_number: inv.invoice_number,
              driver_email: driver?.profiles?.email || '',
              driver_name: `${driver?.profiles?.first_name || ''} ${driver?.profiles?.last_name || ''}`,
              period_start: inv.billing_period_start,
              period_end: inv.billing_period_end,
              total_parcels: inv.total_parcels,
              parcel_rate: inv.parcel_rate,
              total_amount: inv.total_amount
            };
          }),
          admin_email: profile?.email,
          company_id: profile?.company_id
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Invoices sent successfully",
        description: `Sent ${invoices.length} invoices to drivers and admin backup created.`,
      });
      
      // Update invoice status to sent
      const invoiceIds = invoices.map(inv => inv.id);
      supabase
        .from('driver_invoices')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .in('id', invoiceIds);
        
      queryClient.invalidateQueries({ queryKey: ['driver-invoices'] });
      setIsEmailDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error sending invoices",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update invoice status
  const updateInvoiceStatusMutation = useMutation({
    mutationFn: async ({ invoiceId, status }: { invoiceId: string, status: string }) => {
      const updates: any = { status };
      
      if (status === 'sent') {
        updates.sent_at = new Date().toISOString();
      } else if (status === 'paid') {
        updates.paid_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('driver_invoices')
        .update(updates)
        .eq('id', invoiceId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driver-invoices'] });
    }
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline">Pending</Badge>;
      case 'sent':
        return <Badge variant="secondary">Sent</Badge>;
      case 'paid':
        return <Badge variant="default">Paid</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const exportInvoice = (invoice: any) => {
    const driver = driverProfiles.find(d => d.id === invoice.driver_id);
    const driverName = `${driver?.profiles?.first_name || 'Unknown'} ${driver?.profiles?.last_name || 'Driver'}`;
    const driverEmail = driver?.profiles?.email || 'unknown@email.com';
    
    const invoiceData = `
INVOICE: ${invoice.invoice_number}

Driver: ${driverName}
Email: ${driverEmail}
Period: ${format(new Date(invoice.billing_period_start), 'dd/MM/yyyy')} - ${format(new Date(invoice.billing_period_end), 'dd/MM/yyyy')}

Total Parcels Delivered: ${invoice.total_parcels}
Rate per Parcel: £${invoice.parcel_rate.toFixed(2)}
Total Amount: £${invoice.total_amount.toFixed(2)}

Status: ${invoice.status}
Generated: ${format(new Date(invoice.created_at), 'dd/MM/yyyy HH:mm')}
    `.trim();

    const blob = new Blob([invoiceData], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoice-${invoice.invoice_number}.txt`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const stats = useMemo(() => {
    const totalInvoices = invoices.length;
    const totalAmount = invoices.reduce((sum, inv) => sum + inv.total_amount, 0);
    const paidAmount = invoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + inv.total_amount, 0);
    const pendingAmount = invoices.filter(inv => inv.status === 'pending').reduce((sum, inv) => sum + inv.total_amount, 0);
    
    return { totalInvoices, totalAmount, paidAmount, pendingAmount };
  }, [invoices]);

  if (isLoading || metricsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p>Loading finance data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Period Selection */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Finance Dashboard</h2>
          <p className="text-muted-foreground">Comprehensive financial management and reporting</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex gap-2">
            <div className="flex flex-col">
              <Label className="text-xs">From</Label>
              <Input
                type="date"
                value={selectedPeriod.start}
                onChange={(e) => setSelectedPeriod(prev => ({ ...prev, start: e.target.value }))}
                className="w-40"
              />
            </div>
            <div className="flex flex-col">
              <Label className="text-xs">To</Label>
              <Input
                type="date"
                value={selectedPeriod.end}
                onChange={(e) => setSelectedPeriod(prev => ({ ...prev, end: e.target.value }))}
                className="w-40"
              />
            </div>
          </div>
          
          <div className="flex gap-2">
            <Dialog open={isGenerateDialogOpen} onOpenChange={setIsGenerateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Invoices
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Generate Invoices</DialogTitle>
                  <DialogDescription>
                    Create invoices for all drivers for the period {format(new Date(selectedPeriod.start), 'dd/MM/yyyy')} - {format(new Date(selectedPeriod.end), 'dd/MM/yyyy')}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    This will create invoices based on approved EOD reports for the selected period.
                  </p>
                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setIsGenerateDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button 
                      onClick={() => generateInvoicesMutation.mutate()}
                      disabled={generateInvoicesMutation.isPending}
                    >
                      Generate Invoices
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {invoices.length > 0 && (
              <Dialog open={isEmailDialogOpen} onOpenChange={setIsEmailDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Mail className="h-4 w-4 mr-2" />
                    Send & Backup
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Send Invoices</DialogTitle>
                    <DialogDescription>
                      Email invoices to drivers and create admin backup
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <Alert>
                      <Mail className="h-4 w-4" />
                      <AlertDescription>
                        This will:
                        <ul className="list-disc list-inside mt-2 space-y-1">
                          <li>Email individual PDF invoices to each driver</li>
                          <li>Create a ZIP file with all invoices</li>
                          <li>Send the ZIP file to admin email as backup</li>
                          <li>Make the ZIP file available for download</li>
                        </ul>
                      </AlertDescription>
                    </Alert>
                    <div className="flex justify-end space-x-2">
                      <Button variant="outline" onClick={() => setIsEmailDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button 
                        onClick={() => sendInvoicesMutation.mutate()}
                        disabled={sendInvoicesMutation.isPending}
                      >
                        Send Invoices
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      </div>

      {/* Period Metrics Overview */}
      {periodMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Parcels</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{periodMetrics.totalParcels}</div>
              <p className="text-xs text-muted-foreground">delivered in period</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">£{periodMetrics.totalRevenue.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">from parcel deliveries</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Driver Wages</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">£{periodMetrics.totalWages.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">paid to drivers</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
              {periodMetrics.profitAfterCosts >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )}
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${periodMetrics.profitAfterCosts >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                £{periodMetrics.profitAfterCosts.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">after all costs</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Profit Breakdown */}
      {periodMetrics && (
        <Card>
          <CardHeader>
            <CardTitle>Profit Analysis</CardTitle>
            <CardDescription>Detailed breakdown of revenue and costs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <h4 className="font-medium">Revenue & Direct Costs</h4>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span>Total Revenue:</span>
                      <span className="text-green-600 font-medium">£{periodMetrics.totalRevenue.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Driver Wages:</span>
                      <span className="text-red-600">-£{periodMetrics.totalWages.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-medium border-t pt-1">
                      <span>Profit Before Costs:</span>
                      <span className={periodMetrics.profitBeforeCosts >= 0 ? 'text-green-600' : 'text-red-600'}>
                        £{periodMetrics.profitBeforeCosts.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-medium">Operating Costs</h4>
                  <div className="space-y-1">
                    {periodMetrics.operatingCosts.length > 0 ? (
                      periodMetrics.operatingCosts.map((cost, index) => (
                        <div key={index} className="flex justify-between text-sm">
                          <span className="capitalize">{cost.category.replace('_', ' ')}:</span>
                          <span className="text-red-600">-£{cost.amount.toFixed(2)}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-muted-foreground">No operating costs recorded</div>
                    )}
                    <div className="flex justify-between font-medium border-t pt-1">
                      <span>Total Operating Costs:</span>
                      <span className="text-red-600">-£{periodMetrics.totalOperatingCosts.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="border-t pt-4">
                <div className="flex justify-between text-lg font-bold">
                  <span>Final Net Profit:</span>
                  <span className={periodMetrics.profitAfterCosts >= 0 ? 'text-green-600' : 'text-red-600'}>
                    £{periodMetrics.profitAfterCosts.toFixed(2)}
                  </span>
                </div>
                {periodMetrics.profitAfterCosts < 0 && (
                  <div className="flex items-center mt-2 text-sm text-amber-600">
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Operating at a loss for this period
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invoice Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalInvoices}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">£{stats.totalAmount.toFixed(2)}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paid Amount</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">£{stats.paidAmount.toFixed(2)}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Amount</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">£{stats.pendingAmount.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Invoices Table */}
      <Card>
        <CardHeader>
          <CardTitle>Driver Invoices</CardTitle>
          <CardDescription>
            Invoices for period: {format(new Date(selectedPeriod.start), 'dd/MM/yyyy')} - {format(new Date(selectedPeriod.end), 'dd/MM/yyyy')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Parcels</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                    <TableCell>
                      {(() => {
                        const driver = driverProfiles.find(d => d.id === invoice.driver_id);
                        return `${driver?.profiles?.first_name || 'Unknown'} ${driver?.profiles?.last_name || 'Driver'}`;
                      })()}
                    </TableCell>
                    <TableCell>
                      {format(new Date(invoice.billing_period_start), 'dd/MM')} - {format(new Date(invoice.billing_period_end), 'dd/MM/yyyy')}
                    </TableCell>
                    <TableCell>{invoice.total_parcels}</TableCell>
                    <TableCell>£{invoice.parcel_rate.toFixed(2)}</TableCell>
                    <TableCell className="font-semibold">£{invoice.total_amount.toFixed(2)}</TableCell>
                    <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                    <TableCell>
                      <div className="flex space-x-1">
                        <Button size="sm" variant="outline" onClick={() => exportInvoice(invoice)}>
                          <Download className="h-3 w-3" />
                        </Button>
                        <Select onValueChange={(status) => updateInvoiceStatusMutation.mutate({ invoiceId: invoice.id, status })}>
                          <SelectTrigger className="w-20 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="sent">Sent</SelectItem>
                            <SelectItem value="paid">Paid</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          {invoices.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">No invoices found</h3>
              <p>Generate invoices for this period to get started.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};