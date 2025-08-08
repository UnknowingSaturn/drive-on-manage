import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { MobileNav } from '@/components/MobileNav';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Users, 
  Truck, 
  MapPin, 
  FileText, 
  TrendingUp, 
  Calendar, 
  DollarSign, 
  Clock,
  CheckCircle,
  AlertTriangle,
  Activity
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays, isToday } from 'date-fns';
import { useNavigate } from 'react-router-dom';

const AdminDashboard = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();

  // Fetch active drivers count
  const { data: driversData, isLoading: loadingDrivers } = useQuery({
    queryKey: ['active-drivers', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return { active: 0, total: 0 };
      
      const { data: drivers, error } = await supabase
        .from('driver_profiles')
        .select('id, status')
        .eq('company_id', profile.company_id);

      if (error) throw error;

      const active = drivers?.filter(d => d.status === 'active').length || 0;
      return { active, total: drivers?.length || 0 };
    },
    enabled: !!profile?.company_id
  });

  // Fetch total vans count
  const { data: vansData, isLoading: loadingVans } = useQuery({
    queryKey: ['total-vans', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return { active: 0, total: 0 };
      
      const { data: vans, error } = await supabase
        .from('vans')
        .select('id, is_active')
        .eq('company_id', profile.company_id);

      if (error) throw error;

      const active = vans?.filter(v => v.is_active).length || 0;
      return { active, total: vans?.length || 0 };
    },
    enabled: !!profile?.company_id
  });

  // Fetch rounds count
  const { data: roundsData, isLoading: loadingRounds } = useQuery({
    queryKey: ['total-rounds', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return { active: 0, total: 0 };
      
      const { data: rounds, error } = await supabase
        .from('rounds')
        .select('id, is_active')
        .eq('company_id', profile.company_id);

      if (error) throw error;

      const active = rounds?.filter(r => r.is_active).length || 0;
      return { active, total: rounds?.length || 0 };
    },
    enabled: !!profile?.company_id
  });

  // Fetch recent EOD reports
  const { data: eodData, isLoading: loadingEOD } = useQuery({
    queryKey: ['recent-eod-reports', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return { today: 0, pending: 0, total: 0, recent: [] };
      
      const today = new Date().toISOString().split('T')[0];
      const sevenDaysAgo = format(subDays(new Date(), 7), 'yyyy-MM-dd');

      const { data: reports, error } = await supabase
        .from('eod_reports')
        .select(`
          id, 
          log_date, 
          parcels_delivered, 
          estimated_pay, 
          status, 
          timestamp,
          driver_id
        `)
        .eq('company_id', profile.company_id)
        .gte('log_date', sevenDaysAgo)
        .order('timestamp', { ascending: false })
        .limit(5);

      if (error) throw error;

      // Get driver names for recent reports
      const driverIds = reports?.map(r => r.driver_id) || [];
      const { data: drivers } = await supabase
        .from('driver_profiles')
        .select('id, user_id')
        .in('id', driverIds);

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name')
        .in('user_id', drivers?.map(d => d.user_id) || []);

      const recentWithNames = reports?.map(report => {
        const driver = drivers?.find(d => d.id === report.driver_id);
        const profile = profiles?.find(p => p.user_id === driver?.user_id);
        return {
          ...report,
          driver_name: profile ? `${profile.first_name} ${profile.last_name}` : 'Unknown'
        };
      }) || [];

      const todayReports = reports?.filter(r => isToday(new Date(r.log_date))).length || 0;
      const pendingReports = reports?.filter(r => r.status === 'submitted').length || 0;

      return {
        today: todayReports,
        pending: pendingReports,
        total: reports?.length || 0,
        recent: recentWithNames
      };
    },
    enabled: !!profile?.company_id
  });

  // Fetch daily performance stats
  const { data: performanceData, isLoading: loadingPerformance } = useQuery({
    queryKey: ['daily-performance', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return { totalDelivered: 0, totalPay: 0, avgDeliveryRate: 0 };
      
      const sevenDaysAgo = format(subDays(new Date(), 7), 'yyyy-MM-dd');

      const { data: reports, error } = await supabase
        .from('eod_reports')
        .select('parcels_delivered, estimated_pay')
        .eq('company_id', profile.company_id)
        .gte('log_date', sevenDaysAgo);

      if (error) throw error;

      const totalDelivered = reports?.reduce((sum, r) => sum + (r.parcels_delivered || 0), 0) || 0;
      const totalPay = reports?.reduce((sum, r) => sum + (r.estimated_pay || 0), 0) || 0;
      const avgDeliveryRate = reports?.length ? Math.round(totalDelivered / reports.length) : 0;

      return { totalDelivered, totalPay, avgDeliveryRate };
    },
    enabled: !!profile?.company_id
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-success text-success-foreground">Approved</Badge>;
      case 'submitted':
        return <Badge className="bg-warning text-warning-foreground">Pending</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const isLoading = loadingDrivers || loadingVans || loadingRounds || loadingEOD || loadingPerformance;

  if (isLoading) {
    return (
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-background">
          <AppSidebar />
          <SidebarInset className="flex-1">
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p>Loading dashboard...</p>
              </div>
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background no-overflow">
        <AppSidebar />
        
        <SidebarInset className="flex-1 no-overflow">
          <header className="border-b bg-card sticky top-0 z-10">
            <div className="mobile-flex-responsive mobile-container py-3 md:py-4">
              <div className="flex items-center space-x-3">
                <SidebarTrigger className="mr-2 mobile-hidden" />
                <MobileNav className="md:hidden" />
                <div>
                  <h1 className="mobile-heading text-foreground">Admin Dashboard</h1>
                  <p className="text-responsive-sm text-muted-foreground">Overview of your logistics operations</p>
                </div>
              </div>
            </div>
          </header>

          <main className="mobile-container py-4 md:py-6 mobile-space-y no-overflow">
            {/* Welcome Section */}
            <div className="mobile-flex-responsive">
              <div>
                <h2 className="mobile-heading text-gradient">Welcome back, {profile?.first_name}!</h2>
                <p className="text-responsive-base text-muted-foreground mt-1">
                  Here's what's happening with your logistics operations today.
                </p>
              </div>
              <Button 
                onClick={() => navigate('/admin/reports')}
                className="logistics-button mobile-button w-full md:w-auto"
              >
                <FileText className="h-4 w-4 mr-2" />
                <span className="mobile-hidden">View Full Reports</span>
                <span className="mobile-only">Reports</span>
              </Button>
            </div>

            {/* Summary Stats Cards */}
            <div className="mobile-grid-auto gap-3 sm:gap-4 md:gap-6">
              <Card className="logistics-card hover-lift">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-responsive-sm font-medium">Active Drivers</CardTitle>
                  <Users className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl sm:text-2xl font-bold text-gradient">
                    {driversData?.active || 0}
                  </div>
                  <p className="text-responsive-xs text-muted-foreground">
                    of {driversData?.total || 0} total drivers
                  </p>
                  <Progress 
                    value={driversData?.total ? (driversData.active / driversData.total) * 100 : 0} 
                    className="mt-2 h-1"
                  />
                </CardContent>
              </Card>

              <Card className="logistics-card hover-lift">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Vans</CardTitle>
                  <Truck className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gradient">
                    {vansData?.active || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    of {vansData?.total || 0} total vans
                  </p>
                  <Progress 
                    value={vansData?.total ? (vansData.active / vansData.total) * 100 : 0} 
                    className="mt-2 h-1"
                  />
                </CardContent>
              </Card>

              <Card className="logistics-card hover-lift">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Rounds</CardTitle>
                  <MapPin className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gradient">
                    {roundsData?.active || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    of {roundsData?.total || 0} total rounds
                  </p>
                  <Progress 
                    value={roundsData?.total ? (roundsData.active / roundsData.total) * 100 : 0} 
                    className="mt-2 h-1"
                  />
                </CardContent>
              </Card>

              <Card className="logistics-card hover-lift">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">EOD Reports</CardTitle>
                  <FileText className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gradient">
                    {eodData?.today || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    submitted today
                  </p>
                  {(eodData?.pending || 0) > 0 && (
                    <Badge className="bg-warning text-warning-foreground mt-2" variant="outline">
                      {eodData.pending} pending approval
                    </Badge>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Performance Overview */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
              <Card className="logistics-card bg-gradient-dark">
                <CardHeader>
                  <CardTitle className="flex items-center text-gradient">
                    <TrendingUp className="h-5 w-5 mr-2" />
                    Weekly Performance
                  </CardTitle>
                  <CardDescription>Last 7 days overview</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Total Delivered</span>
                      <span className="font-semibold">{performanceData?.totalDelivered || 0} parcels</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Total Pay</span>
                      <span className="font-semibold">£{performanceData?.totalPay?.toFixed(2) || '0.00'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Avg. per Day</span>
                      <span className="font-semibold">{performanceData?.avgDeliveryRate || 0} parcels</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2 logistics-card">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Clock className="h-5 w-5 mr-2 text-primary" />
                    Recent EOD Reports
                  </CardTitle>
                  <CardDescription>Latest end-of-day submissions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {eodData?.recent?.map((report, index) => (
                      <div key={report.id} className="flex items-center justify-between p-3 rounded-lg bg-card/50">
                        <div className="flex items-center space-x-3">
                          <div className="w-2 h-2 rounded-full bg-primary"></div>
                          <div>
                            <p className="font-medium">{report.driver_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {report.parcels_delivered} parcels - £{report.estimated_pay?.toFixed(2)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {getStatusBadge(report.status)}
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(report.log_date), 'MMM dd')}
                          </span>
                        </div>
                      </div>
                    ))}
                    
                    {(!eodData?.recent || eodData.recent.length === 0) && (
                      <div className="text-center py-6 text-muted-foreground">
                        <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No recent EOD reports</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <Card className="logistics-card">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Activity className="h-5 w-5 mr-2 text-primary" />
                  Quick Actions
                </CardTitle>
                <CardDescription>Common administrative tasks</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mobile-grid gap-3 md:gap-4">
                  <Button 
                    variant="outline" 
                    className="h-16 md:h-20 flex-col space-y-1 md:space-y-2 hover-lift mobile-button"
                    onClick={() => navigate('/admin/drivers')}
                  >
                    <Users className="h-5 w-5 md:h-6 md:w-6" />
                    <span className="text-xs md:text-sm">Manage Drivers</span>
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="h-16 md:h-20 flex-col space-y-1 md:space-y-2 hover-lift mobile-button"
                    onClick={() => navigate('/admin/vans')}
                  >
                    <Truck className="h-5 w-5 md:h-6 md:w-6" />
                    <span className="text-xs md:text-sm">Manage Vans</span>
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="h-16 md:h-20 flex-col space-y-1 md:space-y-2 hover-lift mobile-button"
                    onClick={() => navigate('/admin/rounds')}
                  >
                    <MapPin className="h-5 w-5 md:h-6 md:w-6" />
                    <span className="text-xs md:text-sm">Manage Rounds</span>
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="h-16 md:h-20 flex-col space-y-1 md:space-y-2 hover-lift mobile-button"
                    onClick={() => navigate('/admin/schedule')}
                  >
                    <Calendar className="h-5 w-5 md:h-6 md:w-6" />
                    <span className="text-xs md:text-sm">View Schedule</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default AdminDashboard;