import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, TrendingDown, DollarSign, Download, BarChart3, Package, Users } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--muted))', 'hsl(var(--secondary))', 'hsl(var(--accent))'];

export const ProfitLoss = () => {
  const { profile } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  });

  // Fetch P&L data
  const { data: plData, isLoading } = useQuery({
    queryKey: ['profit-loss', profile?.company_id, selectedPeriod],
    queryFn: async () => {
      if (!profile?.company_id) return null;
      
      // Get EOD reports for revenue calculation
      const { data: eodReports, error: eodError } = await supabase
        .from('end_of_day_reports')
        .select('successful_deliveries, successful_collections')
        .eq('company_id', profile.company_id)
        .eq('status', 'approved')
        .gte('log_date', selectedPeriod.start)
        .lte('log_date', selectedPeriod.end);

      if (eodError) throw eodError;

      // Get driver payments (wages)
      const { data: payments, error: paymentsError } = await supabase
        .from('payments')
        .select('total_pay')
        .eq('company_id', profile.company_id)
        .gte('period_start', selectedPeriod.start)
        .lte('period_end', selectedPeriod.end);

      if (paymentsError) throw paymentsError;

      // Get operating costs
      const { data: operatingCosts, error: costsError } = await supabase
        .from('operating_costs')
        .select('*')
        .eq('company_id', profile.company_id)
        .gte('date', selectedPeriod.start)
        .lte('date', selectedPeriod.end);

      if (costsError) throw costsError;

      // Calculate metrics
      const totalParcels = eodReports?.reduce((sum, report) => sum + ((report.successful_deliveries || 0) + (report.successful_collections || 0)), 0) || 0;
      const totalRevenue = totalParcels * 0.50; // £0.50 per parcel
      const totalWages = payments?.reduce((sum, payment) => sum + (payment.total_pay || 0), 0) || 0;
      const totalOperatingCosts = operatingCosts?.reduce((sum, cost) => sum + (cost.amount || 0), 0) || 0;
      
      const grossProfit = totalRevenue - totalWages;
      const netProfit = grossProfit - totalOperatingCosts;
      const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

      // Group operating costs by category
      const costsByCategory = operatingCosts?.reduce((acc: any, cost) => {
        if (!acc[cost.category]) {
          acc[cost.category] = 0;
        }
        acc[cost.category] += cost.amount;
        return acc;
      }, {}) || {};

      return {
        totalRevenue,
        totalWages,
        totalOperatingCosts,
        grossProfit,
        netProfit,
        profitMargin,
        totalParcels,
        costsByCategory,
        operatingCosts: operatingCosts || []
      };
    },
    enabled: !!profile?.company_id
  });

  // Prepare chart data
  const revenueVsCostsData = [
    { name: 'Revenue', value: plData?.totalRevenue || 0 },
    { name: 'Wages', value: plData?.totalWages || 0 },
    { name: 'Operating Costs', value: plData?.totalOperatingCosts || 0 }
  ];

  const costBreakdownData = Object.entries(plData?.costsByCategory || {}).map(([category, amount]) => ({
    name: category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
    value: amount as number
  }));

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading profit & loss data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Profit & Loss</h2>
          <p className="text-muted-foreground">Financial performance overview</p>
        </div>
        
        {/* Period Selection */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="pl-period-start">From:</Label>
            <Input
              id="pl-period-start"
              type="date"
              value={selectedPeriod.start}
              onChange={(e) => setSelectedPeriod(prev => ({ ...prev, start: e.target.value }))}
              className="w-auto"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="pl-period-end">To:</Label>
            <Input
              id="pl-period-end"
              type="date"
              value={selectedPeriod.end}
              onChange={(e) => setSelectedPeriod(prev => ({ ...prev, end: e.target.value }))}
              className="w-auto"
            />
          </div>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">£{plData?.totalRevenue.toFixed(2) || '0.00'}</div>
            <p className="text-xs text-muted-foreground">{plData?.totalParcels || 0} parcels</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Costs</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">£{((plData?.totalWages || 0) + (plData?.totalOperatingCosts || 0)).toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">wages + operating</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
            {(plData?.netProfit || 0) >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${(plData?.netProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              £{plData?.netProfit.toFixed(2) || '0.00'}
            </div>
            <p className="text-xs text-muted-foreground">after all costs</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Profit Margin</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${(plData?.profitMargin || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {plData?.profitMargin.toFixed(1) || '0.0'}%
            </div>
            <p className="text-xs text-muted-foreground">profit margin</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Revenue vs Costs</CardTitle>
            <CardDescription>Comparison of revenue and expenses</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                revenue: { label: "Revenue", color: "hsl(var(--primary))" },
                wages: { label: "Wages", color: "hsl(var(--secondary))" },
                operating: { label: "Operating Costs", color: "hsl(var(--muted))" }
              }}
              className="h-[300px]"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueVsCostsData}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="value" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Cost Breakdown</CardTitle>
            <CardDescription>Operating costs by category</CardDescription>
          </CardHeader>
          <CardContent>
            {costBreakdownData.length > 0 ? (
              <ChartContainer
                config={{}}
                className="h-[300px]"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={costBreakdownData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {costBreakdownData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center border border-dashed rounded-lg">
                <div className="text-center text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No operating costs data available</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* P&L Statement */}
      <Card>
        <CardHeader>
          <CardTitle>Profit & Loss Statement</CardTitle>
          <CardDescription>
            Detailed financial breakdown for {format(new Date(selectedPeriod.start), 'MMM dd')} - {format(new Date(selectedPeriod.end), 'MMM dd, yyyy')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">REVENUE</TableCell>
                <TableCell></TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="pl-8">
                  <div className="flex items-center space-x-2">
                    <Package className="h-4 w-4 text-primary" />
                    <span>Parcel Revenue ({plData?.totalParcels || 0} parcels @ £0.50)</span>
                  </div>
                </TableCell>
                <TableCell className="font-semibold">£{plData?.totalRevenue.toFixed(2) || '0.00'}</TableCell>
              </TableRow>
              
              <TableRow>
                <TableCell className="font-medium">COST OF GOODS SOLD</TableCell>
                <TableCell></TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="pl-8">
                  <div className="flex items-center space-x-2">
                    <Users className="h-4 w-4 text-primary" />
                    <span>Driver Wages</span>
                  </div>
                </TableCell>
                <TableCell>£{plData?.totalWages.toFixed(2) || '0.00'}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">GROSS PROFIT</TableCell>
                <TableCell className={`font-semibold ${(plData?.grossProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  £{plData?.grossProfit.toFixed(2) || '0.00'}
                </TableCell>
              </TableRow>
              
              <TableRow>
                <TableCell className="font-medium">OPERATING EXPENSES</TableCell>
                <TableCell></TableCell>
              </TableRow>
              
              {/* Operating costs by category */}
              {Object.entries(plData?.costsByCategory || {}).map(([category, amount]) => (
                <TableRow key={category}>
                  <TableCell className="pl-8">
                    {category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </TableCell>
                  <TableCell>£{(amount as number).toFixed(2)}</TableCell>
                </TableRow>
              ))}
              
              <TableRow>
                <TableCell className="pl-8 font-medium">Total Operating Expenses</TableCell>
                <TableCell className="font-semibold">£{plData?.totalOperatingCosts.toFixed(2) || '0.00'}</TableCell>
              </TableRow>
              
              <TableRow className="border-t-2">
                <TableCell className="font-bold">NET PROFIT</TableCell>
                <TableCell className={`font-bold text-lg ${(plData?.netProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  £{plData?.netProfit.toFixed(2) || '0.00'}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};