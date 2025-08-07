import React, { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Download, FileText, Send, Plus, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { Label } from '@/components/ui/label';

export const InvoiceManagement = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);

  // Fetch driver invoices
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['driver-invoices', profile?.company_id, selectedMonth.toISOString()],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      
      const { data, error } = await (supabase as any)
        .from('driver_invoices')
        .select(`
          *,
          driver_profiles!inner(
            id,
            profiles!inner(first_name, last_name, email)
          )
        `)
        .eq('company_id', profile.company_id)
        .gte('billing_period_start', format(startOfMonth(selectedMonth), 'yyyy-MM-dd'))
        .lte('billing_period_end', format(endOfMonth(selectedMonth), 'yyyy-MM-dd'))
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.company_id
  });

  // Generate invoices mutation
  const generateInvoicesMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.company_id) return;

      const periodStart = startOfMonth(selectedMonth);
      const periodEnd = endOfMonth(selectedMonth);

      // Get approved EOD reports for the month
      const { data: eodReports, error: eodError } = await supabase
        .from('eod_reports')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('status', 'approved')
        .gte('log_date', format(periodStart, 'yyyy-MM-dd'))
        .lte('log_date', format(periodEnd, 'yyyy-MM-dd'));

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
        acc[report.driver_id].parcels += report.parcels_delivered;
        acc[report.driver_id].reports.push(report);
        return acc;
      }, {} as Record<string, { parcels: number; reports: any[] }>);

      // Create invoices
      const invoicesToCreate = [];
      for (const [driverId, totals] of Object.entries(driverTotals || {})) {
        const driver = drivers?.find(d => d.id === driverId);
        if (!driver) continue;

        const totalParcels = totals.parcels;
        const parcelRate = driver?.parcel_rate || 0.5;
        const totalAmount = totalParcels * parcelRate;
        const invoiceNumber = `INV-${Date.now()}-${driverId.slice(-4)}`;

        invoicesToCreate.push({
          invoice_number: invoiceNumber,
          driver_id: driverId,
          company_id: profile.company_id,
          billing_period_start: format(periodStart, 'yyyy-MM-dd'),
          billing_period_end: format(periodEnd, 'yyyy-MM-dd'),
          total_parcels: totalParcels,
          parcel_rate: parcelRate,
          total_amount: totalAmount,
          status: 'pending',
          generated_by: profile.user_id
        });
      }

      if (invoicesToCreate.length === 0) {
        throw new Error('No invoices to generate');
      }

      const { error } = await (supabase as any)
        .from('driver_invoices')
        .insert(invoicesToCreate);

      if (error) throw error;

      return invoicesToCreate.length;
    },
    onSuccess: (count) => {
      toast({
        title: "Invoices generated",
        description: `Successfully generated ${count} invoice${count !== 1 ? 's' : ''}.`,
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

  // Update invoice status
  const updateInvoiceStatusMutation = useMutation({
    mutationFn: async ({ invoiceId, status }: { invoiceId: string, status: string }) => {
      const updates: any = { status };
      
      if (status === 'sent') {
        updates.sent_at = new Date().toISOString();
      } else if (status === 'paid') {
        updates.paid_at = new Date().toISOString();
      }

      const { error } = await (supabase as any)
        .from('driver_invoices')
        .update(updates)
        .eq('id', invoiceId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Invoice updated",
        description: "Invoice status has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['driver-invoices'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating invoice",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const navigateMonth = (direction: 'prev' | 'next') => {
    setSelectedMonth(prev => direction === 'prev' ? subMonths(prev, 1) : subMonths(prev, -1));
  };

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
    const invoiceData = `
Invoice: ${invoice.invoice_number}
Driver: ${invoice.driver_profiles.profiles.first_name} ${invoice.driver_profiles.profiles.last_name}
Email: ${invoice.driver_profiles.profiles.email}
Period: ${format(new Date(invoice.billing_period_start), 'dd/MM/yyyy')} - ${format(new Date(invoice.billing_period_end), 'dd/MM/yyyy')}
Total Parcels: ${invoice.total_parcels}
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p>Loading invoices...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Driver Invoicing</h2>
          <p className="text-muted-foreground">Generate and manage driver invoices</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={() => navigateMonth('prev')}>←</Button>
          <div className="text-sm font-medium min-w-[150px] text-center">
            {format(selectedMonth, 'MMM yyyy')}
          </div>
          <Button variant="outline" onClick={() => navigateMonth('next')}>→</Button>
          
          <Dialog open={isGenerateDialogOpen} onOpenChange={setIsGenerateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Generate Invoices
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Generate Monthly Invoices</DialogTitle>
                <DialogDescription>
                  Generate invoices for all drivers for {format(selectedMonth, 'MMMM yyyy')}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  This will create invoices based on approved EOD reports for the selected month.
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
        </div>
      </div>

      {/* Statistics Cards */}
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
          <CardTitle>Invoices</CardTitle>
          <CardDescription>
            Monthly invoices for {format(selectedMonth, 'MMMM yyyy')}
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
                      {invoice.driver_profiles.profiles.first_name} {invoice.driver_profiles.profiles.last_name}
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
              <p>Generate invoices for this month to get started.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};