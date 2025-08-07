import React, { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calculator, Download, DollarSign, FileText, Lock, Users, AlertCircle, Edit, Save, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { format, startOfWeek, startOfMonth, endOfWeek, endOfMonth, subWeeks, subMonths } from 'date-fns';
import { Alert, AlertDescription } from '@/components/ui/alert';

const Finance = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month'>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [editingPayment, setEditingPayment] = useState<string | null>(null);
  const [editRates, setEditRates] = useState<Record<string, { parcelRate: string; basePay: string }>>({});

  // Calculate period dates
  const periodStart = selectedPeriod === 'week' ? startOfWeek(currentDate, { weekStartsOn: 1 }) : startOfMonth(currentDate);
  const periodEnd = selectedPeriod === 'week' ? endOfWeek(currentDate, { weekStartsOn: 1 }) : endOfMonth(currentDate);

  // Fetch EOD reports for payment calculation
  const { data: eodReports = [], isLoading: eodLoading } = useQuery({
    queryKey: ['eod-reports-finance', profile?.company_id, periodStart.toISOString(), periodEnd.toISOString()],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      
      const { data, error } = await supabase
        .from('eod_reports')
        .select(`
          *,
          driver:driver_profiles(
            id,
            hourly_rate,
            parcel_rate,
            profiles:profiles(first_name, last_name)
          )
        `)
        .eq('company_id', profile.company_id)
        .gte('log_date', format(periodStart, 'yyyy-MM-dd'))
        .lte('log_date', format(periodEnd, 'yyyy-MM-dd'))
        .eq('status', 'submitted')
        .order('log_date', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.company_id
  });

  // Fetch existing payments
  const { data: payments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ['payments', profile?.company_id, periodStart.toISOString(), periodEnd.toISOString()],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      
      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          driver:driver_profiles(
            id,
            profiles:profiles(first_name, last_name)
          ),
          eod_report:eod_reports(id, log_date, parcels_delivered)
        `)
        .eq('company_id', profile.company_id)
        .gte('period_start', format(periodStart, 'yyyy-MM-dd'))
        .lte('period_end', format(periodEnd, 'yyyy-MM-dd'))
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.company_id
  });

  // Calculate payments mutation
  const calculatePaymentsMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.company_id || !eodReports.length) return;

      const paymentsToCreate = [];

      for (const report of eodReports) {
        // Check if payment already exists
        const existingPayment = payments.find(p => p.eod_report_id === report.id);
        if (existingPayment) continue;

        // Get driver rates with fallback logic
        const driverParcelRate = (report.driver as any)?.parcel_rate || 0.50; // Default £0.50 per parcel
        const basePay = (report.driver as any)?.hourly_rate || 10.00; // Default £10/day base

        const totalPay = (report.parcels_delivered * driverParcelRate) + basePay;

        paymentsToCreate.push({
          company_id: profile.company_id,
          driver_id: report.driver_id,
          eod_report_id: report.id,
          period_start: format(periodStart, 'yyyy-MM-dd'),
          period_end: format(periodEnd, 'yyyy-MM-dd'),
          base_pay: basePay,
          parcel_count: report.parcels_delivered,
          parcel_rate: driverParcelRate,
          total_pay: totalPay,
          status: 'calculated',
          created_by: profile.user_id
        });
      }

      if (paymentsToCreate.length === 0) {
        throw new Error('No new payments to calculate');
      }

      const { error } = await supabase
        .from('payments')
        .insert(paymentsToCreate);

      if (error) throw error;

      return paymentsToCreate.length;
    },
    onSuccess: (count) => {
      toast({
        title: "Payments calculated",
        description: `Successfully calculated ${count} new payment${count !== 1 ? 's' : ''}.`,
      });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error calculating payments",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update payment mutation
  const updatePaymentMutation = useMutation({
    mutationFn: async ({ paymentId, updates }: { paymentId: string, updates: any }) => {
      const { error } = await supabase
        .from('payments')
        .update({
          ...updates,
          manually_adjusted: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', paymentId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Payment updated",
        description: "Payment details have been updated successfully.",
      });
      setEditingPayment(null);
      setEditRates({});
      queryClient.invalidateQueries({ queryKey: ['payments'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating payment",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Lock payments mutation
  const lockPaymentsMutation = useMutation({
    mutationFn: async (paymentIds: string[]) => {
      const { error } = await supabase
        .from('payments')
        .update({ 
          locked: true,
          exported_at: new Date().toISOString(),
          exported_by: profile?.user_id
        })
        .in('id', paymentIds);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Payments locked",
        description: "Selected payments have been locked for export.",
      });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error locking payments",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Group payments by driver
  const paymentsByDriver = useMemo(() => {
    const grouped = payments.reduce((acc, payment) => {
      const driverId = payment.driver_id;
      if (!acc[driverId]) {
        acc[driverId] = {
          driver: payment.driver,
          payments: [],
          totalPay: 0,
          totalParcels: 0,
          totalBasePay: 0
        };
      }
      acc[driverId].payments.push(payment);
      acc[driverId].totalPay += payment.total_pay;
      acc[driverId].totalParcels += payment.parcel_count;
      acc[driverId].totalBasePay += payment.base_pay;
      return acc;
    }, {} as Record<string, any>);

    return Object.values(grouped);
  }, [payments]);

  // Statistics
  const stats = useMemo(() => {
    const totalDrivers = paymentsByDriver.length;
    const totalPay = payments.reduce((sum, p) => sum + p.total_pay, 0);
    const totalParcels = payments.reduce((sum, p) => sum + p.parcel_count, 0);
    const lockedPayments = payments.filter(p => p.locked).length;
    
    return { totalDrivers, totalPay, totalParcels, lockedPayments };
  }, [payments, paymentsByDriver]);

  const exportToCSV = () => {
    const csvData = payments.map(payment => ({
      'Driver Name': `${payment.driver?.profiles?.first_name} ${payment.driver?.profiles?.last_name}`,
      'Period': `${format(new Date(payment.period_start), 'dd/MM/yyyy')} - ${format(new Date(payment.period_end), 'dd/MM/yyyy')}`,
      'Base Pay': `£${payment.base_pay.toFixed(2)}`,
      'Parcels Delivered': payment.parcel_count,
      'Parcel Rate': `£${payment.parcel_rate.toFixed(2)}`,
      'Total Pay': `£${payment.total_pay.toFixed(2)}`,
      'Status': payment.status,
      'Locked': payment.locked ? 'Yes' : 'No',
      'Manually Adjusted': payment.manually_adjusted ? 'Yes' : 'No'
    }));

    const csv = [
      Object.keys(csvData[0] || {}).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payments-${format(periodStart, 'yyyy-MM-dd')}-${format(periodEnd, 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    // Lock exported payments
    const unlockedPaymentIds = payments.filter(p => !p.locked).map(p => p.id);
    if (unlockedPaymentIds.length > 0) {
      lockPaymentsMutation.mutate(unlockedPaymentIds);
    }
  };

  const navigatePeriod = (direction: 'prev' | 'next') => {
    if (selectedPeriod === 'week') {
      setCurrentDate(prev => direction === 'prev' ? subWeeks(prev, 1) : subWeeks(prev, -1));
    } else {
      setCurrentDate(prev => direction === 'prev' ? subMonths(prev, 1) : subMonths(prev, -1));
    }
  };

  const startEditing = (paymentId: string, payment: any) => {
    setEditingPayment(paymentId);
    setEditRates({
      [paymentId]: {
        parcelRate: payment.parcel_rate.toString(),
        basePay: payment.base_pay.toString()
      }
    });
  };

  const saveEditing = (paymentId: string) => {
    const rates = editRates[paymentId];
    if (!rates) return;

    const parcelRate = parseFloat(rates.parcelRate);
    const basePay = parseFloat(rates.basePay);
    const payment = payments.find(p => p.id === paymentId);
    
    if (!payment) return;

    const totalPay = (payment.parcel_count * parcelRate) + basePay;

    updatePaymentMutation.mutate({
      paymentId,
      updates: {
        parcel_rate: parcelRate,
        base_pay: basePay,
        total_pay: totalPay
      }
    });
  };

  const cancelEditing = () => {
    setEditingPayment(null);
    setEditRates({});
  };

  if (eodLoading || paymentsLoading) {
    return (
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-background">
          <AppSidebar />
          <SidebarInset className="flex-1">
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p>Loading finance data...</p>
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
            <div className="flex items-center px-4 py-4">
              <SidebarTrigger className="mr-4" />
              <div className="flex-1">
                <h1 className="text-xl font-semibold text-foreground">Finance Management</h1>
                <p className="text-sm text-muted-foreground">
                  Calculate and manage driver payments
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <Select value={selectedPeriod} onValueChange={(value: 'week' | 'month') => setSelectedPeriod(value)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="week">Weekly</SelectItem>
                    <SelectItem value="month">Monthly</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={() => navigatePeriod('prev')}>←</Button>
                <div className="text-sm font-medium min-w-[200px] text-center">
                  {selectedPeriod === 'week' 
                    ? `Week of ${format(periodStart, 'MMM dd, yyyy')}`
                    : `${format(periodStart, 'MMM yyyy')}`
                  }
                </div>
                <Button variant="outline" onClick={() => navigatePeriod('next')}>→</Button>
              </div>
            </div>
          </header>

          <main className="p-6 space-y-6">
            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Drivers</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalDrivers}</div>
                  <p className="text-xs text-muted-foreground">with payments</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Payouts</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">£{stats.totalPay.toFixed(2)}</div>
                  <p className="text-xs text-muted-foreground">this period</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Parcels</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalParcels}</div>
                  <p className="text-xs text-muted-foreground">delivered</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Locked Reports</CardTitle>
                  <Lock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.lockedPayments}</div>
                  <p className="text-xs text-muted-foreground">exported</p>
                </CardContent>
              </Card>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between items-center">
              <div className="space-x-2">
                <Button 
                  onClick={() => calculatePaymentsMutation.mutate()}
                  disabled={calculatePaymentsMutation.isPending || eodReports.length === 0}
                >
                  <Calculator className="h-4 w-4 mr-2" />
                  Calculate Payments
                </Button>
                
                <Button 
                  variant="outline"
                  onClick={exportToCSV}
                  disabled={payments.length === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </div>
              
              {eodReports.length === 0 && (
                <Alert className="w-auto">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No EOD reports found for this period.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <Tabs defaultValue="summary" className="space-y-4">
              <TabsList>
                <TabsTrigger value="summary">Driver Summary</TabsTrigger>
                <TabsTrigger value="details">Payment Details</TabsTrigger>
              </TabsList>
              
              <TabsContent value="summary" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Driver Payment Summary</CardTitle>
                    <CardDescription>
                      {selectedPeriod === 'week' ? 'Weekly' : 'Monthly'} payment overview by driver
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Driver</TableHead>
                            <TableHead>Reports</TableHead>
                            <TableHead>Total Parcels</TableHead>
                            <TableHead>Base Pay</TableHead>
                            <TableHead>Total Earnings</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paymentsByDriver.map((driverGroup) => (
                            <TableRow key={driverGroup.driver?.id}>
                              <TableCell className="font-medium">
                                {driverGroup.driver?.profiles?.first_name} {driverGroup.driver?.profiles?.last_name}
                              </TableCell>
                              <TableCell>{driverGroup.payments.length}</TableCell>
                              <TableCell>{driverGroup.totalParcels}</TableCell>
                              <TableCell>£{driverGroup.totalBasePay.toFixed(2)}</TableCell>
                              <TableCell className="font-semibold">£{driverGroup.totalPay.toFixed(2)}</TableCell>
                              <TableCell>
                                <div className="flex space-x-1">
                                  {driverGroup.payments.some((p: any) => p.locked) && (
                                    <Badge variant="outline">
                                      <Lock className="h-3 w-3 mr-1" />
                                      Locked
                                    </Badge>
                                  )}
                                  {driverGroup.payments.some((p: any) => p.manually_adjusted) && (
                                    <Badge variant="secondary">Adjusted</Badge>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    
                    {paymentsByDriver.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <h3 className="text-lg font-medium mb-2">No payments calculated</h3>
                        <p>Click "Calculate Payments" to generate payments from EOD reports.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="details" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Payment Details</CardTitle>
                    <CardDescription>
                      Individual payment records with edit capabilities
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Driver</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Parcels</TableHead>
                            <TableHead>Parcel Rate</TableHead>
                            <TableHead>Base Pay</TableHead>
                            <TableHead>Total Pay</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {payments.map((payment) => (
                            <TableRow key={payment.id}>
                              <TableCell className="font-medium">
                                {payment.driver?.profiles?.first_name} {payment.driver?.profiles?.last_name}
                              </TableCell>
                              <TableCell>
                                {format(new Date(payment.eod_report?.log_date || ''), 'dd/MM/yyyy')}
                              </TableCell>
                              <TableCell>{payment.parcel_count}</TableCell>
                              <TableCell>
                                {editingPayment === payment.id ? (
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={editRates[payment.id]?.parcelRate || ''}
                                    onChange={(e) => setEditRates(prev => ({
                                      ...prev,
                                      [payment.id]: {
                                        ...prev[payment.id],
                                        parcelRate: e.target.value
                                      }
                                    }))}
                                    className="w-20"
                                  />
                                ) : (
                                  `£${payment.parcel_rate.toFixed(2)}`
                                )}
                              </TableCell>
                              <TableCell>
                                {editingPayment === payment.id ? (
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={editRates[payment.id]?.basePay || ''}
                                    onChange={(e) => setEditRates(prev => ({
                                      ...prev,
                                      [payment.id]: {
                                        ...prev[payment.id],
                                        basePay: e.target.value
                                      }
                                    }))}
                                    className="w-20"
                                  />
                                ) : (
                                  `£${payment.base_pay.toFixed(2)}`
                                )}
                              </TableCell>
                              <TableCell className="font-semibold">
                                £{payment.total_pay.toFixed(2)}
                              </TableCell>
                              <TableCell>
                                <div className="flex space-x-1">
                                  <Badge variant={
                                    payment.status === 'paid' ? 'default' :
                                    payment.status === 'approved' ? 'secondary' :
                                    'outline'
                                  }>
                                    {payment.status}
                                  </Badge>
                                  {payment.locked && (
                                    <Badge variant="outline">
                                      <Lock className="h-3 w-3" />
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                {!payment.locked && (
                                  <div className="flex space-x-1">
                                    {editingPayment === payment.id ? (
                                      <>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => saveEditing(payment.id)}
                                          disabled={updatePaymentMutation.isPending}
                                        >
                                          <Save className="h-3 w-3" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={cancelEditing}
                                        >
                                          <X className="h-3 w-3" />
                                        </Button>
                                      </>
                                    ) : (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => startEditing(payment.id, payment)}
                                      >
                                        <Edit className="h-3 w-3" />
                                      </Button>
                                    )}
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    
                    {payments.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <Calculator className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <h3 className="text-lg font-medium mb-2">No payment details</h3>
                        <p>Payment calculations will appear here once generated.</p>
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

export default Finance;