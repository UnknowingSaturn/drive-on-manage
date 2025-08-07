import React, { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, TrendingDown, DollarSign, Download, BarChart3 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, subYears } from 'date-fns';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];

export const ProfitLoss = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [selectedPeriod, setSelectedPeriod] = useState<'month' | 'year'>('month');
  const [currentDate, setCurrentDate] = useState(new Date());

  // Calculate period dates
  const periodStart = selectedPeriod === 'month' 
    ? startOfMonth(currentDate) 
    : startOfYear(currentDate);
  const periodEnd = selectedPeriod === 'month' 
    ? endOfMonth(currentDate) 
    : endOfYear(currentDate);

  // Fetch revenue data (from EOD reports)
  const { data: revenueData = [], isLoading: revenueLoading } = useQuery({
    queryKey: ['pl-revenue', profile?.company_id, periodStart.toISOString(), periodEnd.toISOString()],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      
      const { data, error } = await supabase
        .from('eod_reports')
        .select(`
          log_date,
          parcels_delivered,
          driver_profiles!inner(parcel_rate)
        `)
        .eq('company_id', profile.company_id)
        .eq('status', 'approved')
        .gte('log_date', format(periodStart, 'yyyy-MM-dd'))
        .lte('log_date', format(periodEnd, 'yyyy-MM-dd'))
        .order('log_date', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.company_id
  });

  // Fetch operating costs
  const { data: operatingCosts = [], isLoading: costsLoading } = useQuery({
    queryKey: ['pl-costs', profile?.company_id, periodStart.toISOString(), periodEnd.toISOString()],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      
      const { data, error } = await supabase
        .from('operating_costs')
        .select('*')
        .eq('company_id', profile.company_id)
        .gte('date', format(periodStart, 'yyyy-MM-dd'))
        .lte('date', format(periodEnd, 'yyyy-MM-dd'))
        .order('date', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.company_id
  });

  // Fetch driver payments (costs)
  const { data: driverPayments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ['pl-payments', profile?.company_id, periodStart.toISOString(), periodEnd.toISOString()],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('company_id', profile.company_id)
        .gte('period_start', format(periodStart, 'yyyy-MM-dd'))
        .lte('period_end', format(periodEnd, 'yyyy-MM-dd'))
        .order('period_start', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.company_id
  });

  // Calculate P&L data
  const plData = useMemo(() => {
    // Calculate total revenue (estimated based on parcels * rates)
    const totalRevenue = revenueData.reduce((sum, report) => 
      sum + (report.parcels_delivered * (report.driver_profiles?.parcel_rate || 0.5)), 0
    );

    // Calculate driver costs
    const totalDriverCosts = driverPayments.reduce((sum, payment) => sum + payment.total_pay, 0);

    // Calculate operating costs by category
    const costsByCategory = operatingCosts.reduce((acc, cost) => {
      acc[cost.category] = (acc[cost.category] || 0) + cost.amount;
      return acc;
    }, {} as Record<string, number>);

    const totalOperatingCosts = operatingCosts.reduce((sum, cost) => sum + cost.amount, 0);
    const totalCosts = totalDriverCosts + totalOperatingCosts;
    const grossProfit = totalRevenue - totalDriverCosts;
    const netProfit = totalRevenue - totalCosts;

    return {
      totalRevenue,
      totalDriverCosts,
      totalOperatingCosts,
      totalCosts,
      grossProfit,
      netProfit,
      costsByCategory,
      profitMargin: totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0
    };
  }, [revenueData, operatingCosts, driverPayments]);

  // Prepare chart data
  const chartData = useMemo(() => {
    const months = [];
    const revenueByMonth: Record<string, number> = {};
    const costsByMonth: Record<string, number> = {};

    // Group revenue by month
    revenueData.forEach(report => {
      const month = format(new Date(report.log_date), 'MMM yyyy');
      revenueByMonth[month] = (revenueByMonth[month] || 0) + 
        (report.parcels_delivered * (report.driver_profiles?.parcel_rate || 0.5));
    });

    // Group costs by month
    [...operatingCosts, ...driverPayments].forEach(item => {
      const date = 'date' in item ? item.date : item.period_start;
      const month = format(new Date(date), 'MMM yyyy');
      const amount = 'amount' in item ? item.amount : item.total_pay;
      costsByMonth[month] = (costsByMonth[month] || 0) + amount;
    });

    // Create chart data
    const allMonths = new Set([...Object.keys(revenueByMonth), ...Object.keys(costsByMonth)]);
    
    return Array.from(allMonths).sort().map(month => ({
      month,
      revenue: revenueByMonth[month] || 0,
      costs: costsByMonth[month] || 0,
      profit: (revenueByMonth[month] || 0) - (costsByMonth[month] || 0)
    }));
  }, [revenueData, operatingCosts, driverPayments]);

  // Prepare pie chart data for costs breakdown
  const costsPieData = useMemo(() => {
    const data = [
      { name: 'Driver Payments', value: plData.totalDriverCosts, color: COLORS[0] },
      ...Object.entries(plData.costsByCategory).map(([category, amount], index) => ({
        name: category.split('_').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' '),
        value: amount,
        color: COLORS[(index + 1) % COLORS.length]
      }))
    ].filter(item => item.value > 0);
    
    return data;
  }, [plData]);

  const navigatePeriod = (direction: 'prev' | 'next') => {
    if (selectedPeriod === 'month') {
      setCurrentDate(prev => direction === 'prev' ? subMonths(prev, 1) : subMonths(prev, -1));
    } else {
      setCurrentDate(prev => direction === 'prev' ? subYears(prev, 1) : subYears(prev, -1));
    }
  };

  const exportPL = () => {
    const plReport = `
Profit & Loss Report
Company: ${profile?.company_id}
Period: ${format(periodStart, 'dd/MM/yyyy')} - ${format(periodEnd, 'dd/MM/yyyy')}

REVENUE
Total Revenue: £${plData.totalRevenue.toFixed(2)}

COSTS
Driver Payments: £${plData.totalDriverCosts.toFixed(2)}
Operating Costs: £${plData.totalOperatingCosts.toFixed(2)}
${Object.entries(plData.costsByCategory).map(([cat, amount]) => 
  `  - ${cat.replace('_', ' ')}: £${amount.toFixed(2)}`
).join('\n')}
Total Costs: £${plData.totalCosts.toFixed(2)}

PROFIT
Gross Profit: £${plData.grossProfit.toFixed(2)}
Net Profit: £${plData.netProfit.toFixed(2)}
Profit Margin: ${plData.profitMargin.toFixed(2)}%

Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')}
    `.trim();

    const blob = new Blob([plReport], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pl-report-${format(periodStart, 'yyyy-MM-dd')}-${format(periodEnd, 'yyyy-MM-dd')}.txt`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (revenueLoading || costsLoading || paymentsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p>Loading P&L data...</p>
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
        <div className="flex items-center space-x-2">
          <Select value={selectedPeriod} onValueChange={(value: 'month' | 'year') => setSelectedPeriod(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Monthly</SelectItem>
              <SelectItem value="year">Yearly</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => navigatePeriod('prev')}>←</Button>
          <div className="text-sm font-medium min-w-[150px] text-center">
            {selectedPeriod === 'month' 
              ? format(currentDate, 'MMM yyyy')
              : format(currentDate, 'yyyy')
            }
          </div>
          <Button variant="outline" onClick={() => navigatePeriod('next')}>→</Button>
          <Button variant="outline" onClick={exportPL}>
            <Download className="h-4 w-4 mr-2" />
            Export
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
            <div className="text-2xl font-bold text-green-600">£{plData.totalRevenue.toFixed(2)}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Costs</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">£{plData.totalCosts.toFixed(2)}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
            {plData.netProfit >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${plData.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              £{plData.netProfit.toFixed(2)}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Profit Margin</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${plData.profitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {plData.profitMargin.toFixed(1)}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Revenue vs Costs Trend</CardTitle>
            <CardDescription>Monthly comparison of revenue and costs</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                revenue: { label: "Revenue", color: "hsl(var(--primary))" },
                costs: { label: "Costs", color: "hsl(var(--destructive))" },
                profit: { label: "Profit", color: "hsl(var(--secondary))" }
              }}
              className="h-[300px]"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="month" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" />
                  <Bar dataKey="costs" fill="hsl(var(--destructive))" />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Cost Breakdown</CardTitle>
            <CardDescription>Distribution of costs by category</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                costs: { label: "Costs", color: "hsl(var(--primary))" }
              }}
              className="h-[300px]"
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={costsPieData}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    fill="hsl(var(--primary))"
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {costsPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* P&L Statement */}
      <Card>
        <CardHeader>
          <CardTitle>Profit & Loss Statement</CardTitle>
          <CardDescription>
            Detailed financial breakdown for {selectedPeriod === 'month' 
              ? format(currentDate, 'MMMM yyyy')
              : format(currentDate, 'yyyy')
            }
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
                <TableCell className="pl-8">Total Revenue</TableCell>
                <TableCell className="font-semibold text-green-600">£{plData.totalRevenue.toFixed(2)}</TableCell>
              </TableRow>
              
              <TableRow>
                <TableCell className="font-medium">COST OF GOODS SOLD</TableCell>
                <TableCell></TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="pl-8">Driver Payments</TableCell>
                <TableCell className="text-red-600">£{plData.totalDriverCosts.toFixed(2)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">GROSS PROFIT</TableCell>
                <TableCell className={`font-semibold ${plData.grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  £{plData.grossProfit.toFixed(2)}
                </TableCell>
              </TableRow>
              
              <TableRow>
                <TableCell className="font-medium">OPERATING EXPENSES</TableCell>
                <TableCell></TableCell>
              </TableRow>
              {Object.entries(plData.costsByCategory).map(([category, amount]) => (
                <TableRow key={category}>
                  <TableCell className="pl-8 capitalize">{category.replace('_', ' ')}</TableCell>
                  <TableCell className="text-red-600">£{amount.toFixed(2)}</TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell className="pl-8 font-medium">Total Operating Expenses</TableCell>
                <TableCell className="font-semibold text-red-600">£{plData.totalOperatingCosts.toFixed(2)}</TableCell>
              </TableRow>
              
              <TableRow className="border-t-2">
                <TableCell className="font-bold">NET PROFIT</TableCell>
                <TableCell className={`font-bold text-lg ${plData.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  £{plData.netProfit.toFixed(2)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};