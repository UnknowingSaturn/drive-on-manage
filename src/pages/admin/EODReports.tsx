import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Package, TrendingUp, Download, Calendar, DollarSign, CheckCircle, AlertCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays, startOfWeek, endOfWeek } from 'date-fns';

const EODReports = () => {
  const { profile } = useAuth();
  const [timeFilter, setTimeFilter] = useState('week');

  // Fetch daily logs with driver information
  const { data: dailyLogs, isLoading } = useQuery({
    queryKey: ['daily-logs', profile?.company_id, timeFilter],
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

      const { data: logs, error: logsError } = await supabase
        .from('daily_logs')
        .select('*')
        .eq('company_id', profile.company_id)
        .gte('log_date', format(dateFilter, 'yyyy-MM-dd'))
        .order('log_date', { ascending: false });

      if (logsError) throw logsError;

      // Fetch driver profiles and rounds separately
      const { data: drivers } = await supabase
        .from('driver_profiles')
        .select('id, user_id, profiles!user_id(first_name, last_name)')
        .in('id', logs?.map(l => l.driver_id) || []);

      const { data: rounds } = await supabase
        .from('rounds')
        .select('id, round_number')
        .in('id', logs?.map(l => l.round_id).filter(Boolean) || []);

      return logs?.map(log => ({
        ...log,
        driver_profiles: drivers?.find(d => d.id === log.driver_id),
        rounds: rounds?.find(r => r.id === log.round_id)
      })) || [];
    },
    enabled: !!profile?.company_id
  });

  // Calculate summary statistics
  const totalParcelsAssigned = dailyLogs?.reduce((sum, log) => sum + (log.sod_parcel_count || 0), 0) || 0;
  const totalParcelsDelivered = dailyLogs?.reduce((sum, log) => sum + (log.eod_delivered_count || 0), 0) || 0;
  const totalEstimatedPay = dailyLogs?.reduce((sum, log) => sum + (log.estimated_pay || 0), 0) || 0;
  const deliveryRate = totalParcelsAssigned > 0 ? ((totalParcelsDelivered / totalParcelsAssigned) * 100).toFixed(1) : '0';

  const getStatusBadge = (log: any) => {
    if (log.status === 'completed') {
      return (
        <Badge className="bg-success text-success-foreground">
          <CheckCircle className="h-3 w-3 mr-1" />
          Complete
        </Badge>
      );
    }
    if (log.status === 'in_progress') {
      return (
        <Badge className="bg-warning text-warning-foreground">
          <AlertCircle className="h-3 w-3 mr-1" />
          In Progress
        </Badge>
      );
    }
    return (
      <Badge variant="secondary">
        {log.status}
      </Badge>
    );
  };

  const exportToCSV = () => {
    if (!dailyLogs?.length) return;

    const headers = [
      'Date',
      'Driver',
      'Round',
      'Parcels Assigned',
      'Parcels Delivered',
      'Delivery Rate',
      'Estimated Pay',
      'Status'
    ];

    const csvData = dailyLogs.map(log => [
      format(new Date(log.log_date), 'dd/MM/yyyy'),
      `${log.driver_profiles?.profiles?.first_name} ${log.driver_profiles?.profiles?.last_name}`,
      log.rounds?.round_number || '-',
      log.sod_parcel_count || 0,
      log.eod_delivered_count || 0,
      log.sod_parcel_count ? `${((log.eod_delivered_count || 0) / log.sod_parcel_count * 100).toFixed(1)}%` : '0%',
      log.estimated_pay ? `£${log.estimated_pay}` : '£0.00',
      log.status
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

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">EOD Reports & Finance</h1>
          <p className="text-muted-foreground">Track deliveries and financial performance</p>
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
            <CardTitle className="text-sm font-medium">Parcels Assigned</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalParcelsAssigned}</div>
            <p className="text-xs text-muted-foreground">
              {timeFilter === 'today' ? 'Today' : timeFilter === 'week' ? 'This week' : 'Last 30 days'}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Parcels Delivered</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{totalParcelsDelivered}</div>
            <p className="text-xs text-muted-foreground">
              {deliveryRate}% delivery rate
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
              Pending payroll processing
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Days</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dailyLogs?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              Days with activity
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daily Performance Reports</CardTitle>
          <CardDescription>End of day submissions and delivery tracking</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead>Round</TableHead>
                <TableHead>Assigned</TableHead>
                <TableHead>Delivered</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Est. Pay</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dailyLogs?.map((log) => {
                const deliveryRate = log.sod_parcel_count 
                  ? ((log.eod_delivered_count || 0) / log.sod_parcel_count * 100).toFixed(1)
                  : '0';
                
                return (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium">
                      {format(new Date(log.log_date), 'dd/MM/yyyy')}
                    </TableCell>
                    <TableCell>
                      {log.driver_profiles?.profiles?.first_name} {log.driver_profiles?.profiles?.last_name}
                    </TableCell>
                    <TableCell>
                      {log.rounds?.round_number || '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <Package className="h-3 w-3 mr-1 text-muted-foreground" />
                        {log.sod_parcel_count || 0}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <CheckCircle className="h-3 w-3 mr-1 text-success" />
                        {log.eod_delivered_count || 0}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={parseFloat(deliveryRate) >= 90 ? 'default' : 'secondary'}>
                        {deliveryRate}%
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {log.estimated_pay ? `£${log.estimated_pay}` : '-'}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(log)}
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm">
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          
          {dailyLogs?.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No daily logs found for the selected time period.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EODReports;