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
            {/* Luxury Welcome Section */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 backdrop-blur-sm">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-50"></div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl transform translate-x-16 -translate-y-16"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-secondary/10 rounded-full blur-2xl transform -translate-x-12 translate-y-12"></div>
              
              <div className="relative p-6 md:p-8">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
                  <div className="animate-fade-in">
                    <div className="flex items-center space-x-3 mb-2">
                      <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                      <span className="text-sm font-medium text-primary uppercase tracking-wider">Admin Dashboard</span>
                    </div>
                    <h2 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-foreground via-primary to-foreground bg-clip-text text-transparent mb-2">
                      Welcome back, {profile?.first_name}!
                    </h2>
                    <p className="text-base text-muted-foreground max-w-2xl leading-relaxed">
                      Here's what's happening with your logistics operations today. Monitor performance, track deliveries, and manage your fleet efficiently.
                    </p>
                  </div>
                  
                  <div className="animate-scale-in">
                    <Button 
                      onClick={() => navigate('/admin/reports')}
                      className="group relative overflow-hidden bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary text-primary-foreground border-0 shadow-lg hover:shadow-xl transition-all duration-300 px-6 py-3 rounded-xl"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                      <div className="relative flex items-center space-x-2">
                        <FileText className="h-4 w-4 transition-transform group-hover:scale-110" />
                        <span className="font-medium">
                          <span className="hidden md:inline">View Full Reports</span>
                          <span className="md:hidden">Reports</span>
                        </span>
                      </div>
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Compact Active Stats Widgets */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              <Card className="logistics-card hover-lift">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Users className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-muted-foreground truncate">Active Drivers</p>
                      <div className="flex items-center space-x-2">
                        <span className="text-xl font-bold text-foreground">{driversData?.active || 0}</span>
                        <span className="text-xs text-muted-foreground">/ {driversData?.total || 0}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="logistics-card hover-lift">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Truck className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-muted-foreground truncate">Active Vans</p>
                      <div className="flex items-center space-x-2">
                        <span className="text-xl font-bold text-foreground">{vansData?.active || 0}</span>
                        <span className="text-xs text-muted-foreground">/ {vansData?.total || 0}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="logistics-card hover-lift">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <MapPin className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-muted-foreground truncate">Active Rounds</p>
                      <div className="flex items-center space-x-2">
                        <span className="text-xl font-bold text-foreground">{roundsData?.active || 0}</span>
                        <span className="text-xs text-muted-foreground">/ {roundsData?.total || 0}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="logistics-card hover-lift">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <FileText className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-muted-foreground truncate">EOD Today</p>
                      <div className="flex items-center space-x-2">
                        <span className="text-xl font-bold text-foreground">{eodData?.today || 0}</span>
                        {(eodData?.pending || 0) > 0 && (
                          <Badge variant="outline" className="text-xs px-1 py-0 h-4 bg-warning/20 text-warning border-warning">
                            {eodData.pending}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Main Dashboard Widgets Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
              
              {/* Company Overview Widget */}
              <Card className="logistics-card">
                <CardHeader>
                  <CardTitle className="flex items-center text-foreground">
                    <Users className="h-5 w-5 mr-2 text-primary" />
                    Company Overview
                  </CardTitle>
                  <CardDescription>Operations at a glance</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Active Drivers</span>
                      <span className="font-semibold text-foreground">{driversData?.active || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Active Rounds</span>
                      <span className="font-semibold text-foreground">{roundsData?.active || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">EOD Reports Today</span>
                      <span className="font-semibold text-foreground">{eodData?.today || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Pending Approvals</span>
                      <span className="font-semibold text-warning">{eodData?.pending || 0}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Driver Performance Widget */}
              <Card className="logistics-card">
                <CardHeader>
                  <CardTitle className="flex items-center text-foreground">
                    <TrendingUp className="h-5 w-5 mr-2 text-primary" />
                    Driver Performance
                  </CardTitle>
                  <CardDescription>Weekly performance metrics</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Total Deliveries</span>
                      <span className="font-semibold text-foreground">{performanceData?.totalDelivered || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Success Rate</span>
                      <span className="font-semibold text-success">98.5%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Support Parcels</span>
                      <span className="font-semibold text-foreground">127</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Avg. Daily Rate</span>
                      <span className="font-semibold text-foreground">{performanceData?.avgDeliveryRate || 0}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Finance Overview Widget */}
              <Card className="logistics-card">
                <CardHeader>
                  <CardTitle className="flex items-center text-foreground">
                    <DollarSign className="h-5 w-5 mr-2 text-primary" />
                    Finance Overview
                  </CardTitle>
                  <CardDescription>Monthly financial summary</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Monthly Invoices</span>
                      <span className="font-semibold text-foreground">£{performanceData?.totalPay?.toFixed(2) || '0.00'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Expenses</span>
                      <span className="font-semibold text-destructive">£2,450.00</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Net P&L</span>
                      <span className="font-semibold text-success">+£8,750.00</span>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      onClick={() => navigate('/admin/finance')}
                    >
                      View Finance
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Second Row Widgets */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
              
              {/* Schedule & Round Assignment Widget */}
              <Card className="logistics-card">
                <CardHeader>
                  <CardTitle className="flex items-center text-foreground">
                    <Calendar className="h-5 w-5 mr-2 text-primary" />
                    Schedule & Routes
                  </CardTitle>
                  <CardDescription>Today's assignments and planning</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                      <div>
                        <p className="font-medium text-foreground">Today's Assignments</p>
                        <p className="text-sm text-muted-foreground">{driversData?.active || 0} drivers scheduled</p>
                      </div>
                      <CheckCircle className="h-5 w-5 text-success" />
                    </div>
                    <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                      <div>
                        <p className="font-medium text-foreground">Unassigned Rounds</p>
                        <p className="text-sm text-muted-foreground">2 rounds need assignment</p>
                      </div>
                      <AlertTriangle className="h-5 w-5 text-warning" />
                    </div>
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => navigate('/admin/schedule')}
                    >
                      Manage Schedule
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Pending Onboardings / Driver Status Widget */}
              <Card className="logistics-card">
                <CardHeader>
                  <CardTitle className="flex items-center text-foreground">
                    <FileText className="h-5 w-5 mr-2 text-primary" />
                    Driver Status
                  </CardTitle>
                  <CardDescription>Onboarding and document status</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                      <div>
                        <p className="font-medium text-foreground">Pending Onboarding</p>
                        <p className="text-sm text-muted-foreground">3 drivers need completion</p>
                      </div>
                      <Badge variant="outline" className="bg-warning/20 text-warning border-warning">3</Badge>
                    </div>
                    <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                      <div>
                        <p className="font-medium text-foreground">Document Expiry</p>
                        <p className="text-sm text-muted-foreground">1 license expires soon</p>
                      </div>
                      <Badge variant="outline" className="bg-destructive/20 text-destructive border-destructive">1</Badge>
                    </div>
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => navigate('/admin/drivers')}
                    >
                      Manage Drivers
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* News & Chat Manager Widget */}
            <Card className="logistics-card">
              <CardHeader>
                <CardTitle className="flex items-center text-foreground">
                  <Activity className="h-5 w-5 mr-2 text-primary" />
                  News & Communication
                </CardTitle>
                <CardDescription>Company announcements and chat management</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <h4 className="font-medium text-foreground">Recent Activity</h4>
                    {eodData?.recent?.slice(0, 3).map((report, index) => (
                      <div key={report.id} className="flex items-center space-x-3 p-2 rounded bg-muted/30">
                        <div className="w-2 h-2 rounded-full bg-primary"></div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">{report.driver_name}</p>
                          <p className="text-xs text-muted-foreground">
                            Submitted EOD: {report.parcels_delivered} parcels
                          </p>
                        </div>
                        {getStatusBadge(report.status)}
                      </div>
                    ))}
                  </div>
                  <div className="space-y-3">
                    <h4 className="font-medium text-foreground">Quick Actions</h4>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full justify-start"
                      onClick={() => navigate('/admin/announcements')}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Create Announcement
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full justify-start"
                      onClick={() => navigate('/admin/chat')}
                    >
                      <Activity className="h-4 w-4 mr-2" />
                      View Chat History
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

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