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

          <main className="p-6 space-y-8">
            {/* Elegant Welcome Section */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 backdrop-blur-sm">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-50"></div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl transform translate-x-16 -translate-y-16"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-secondary/10 rounded-full blur-2xl transform -translate-x-12 translate-y-12"></div>
              
              <div className="relative p-8">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-6 lg:space-y-0">
                  <div className="animate-fade-in space-y-3">
                    <div className="flex items-center space-x-3 mb-2">
                      <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                      <span className="text-sm font-medium text-primary uppercase tracking-wider">Admin Dashboard</span>
                    </div>
                    <h2 className="text-3xl lg:text-4xl font-bold bg-gradient-to-r from-foreground via-primary to-foreground bg-clip-text text-transparent">
                      Welcome back, {profile?.first_name}!
                    </h2>
                    <p className="text-base text-muted-foreground max-w-2xl leading-relaxed">
                      Here's what's happening with your logistics operations today. Monitor performance, track deliveries, and manage your fleet efficiently.
                    </p>
                  </div>
                  
                  <div className="animate-scale-in">
                    <Button 
                      onClick={() => navigate('/admin/reports')}
                      className="group relative overflow-hidden bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary text-primary-foreground border-0 shadow-lg hover:shadow-xl transition-all duration-300 px-8 py-4 rounded-xl text-base"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                      <div className="relative flex items-center space-x-3">
                        <FileText className="h-5 w-5 transition-transform group-hover:scale-110" />
                        <span className="font-medium">View Full Reports</span>
                      </div>
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Refined Compact Stats Widgets */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="group relative overflow-hidden bg-gradient-to-br from-card via-card to-card/50 border border-border/50 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/3 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/10 group-hover:scale-105 transition-transform duration-300">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-muted-foreground mb-1">Active Drivers</p>
                      <div className="flex items-baseline space-x-2">
                        <span className="text-2xl font-bold bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">{driversData?.active || 0}</span>
                        <span className="text-sm text-muted-foreground font-medium">/ {driversData?.total || 0}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="group relative overflow-hidden bg-gradient-to-br from-card via-card to-card/50 border border-border/50 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                <div className="absolute inset-0 bg-gradient-to-br from-secondary/3 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-secondary/15 to-secondary/5 border border-secondary/10 group-hover:scale-105 transition-transform duration-300">
                      <Truck className="h-5 w-5 text-secondary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-muted-foreground mb-1">Active Vans</p>
                      <div className="flex items-baseline space-x-2">
                        <span className="text-2xl font-bold bg-gradient-to-r from-foreground to-secondary bg-clip-text text-transparent">{vansData?.active || 0}</span>
                        <span className="text-sm text-muted-foreground font-medium">/ {vansData?.total || 0}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="group relative overflow-hidden bg-gradient-to-br from-card via-card to-card/50 border border-border/50 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                <div className="absolute inset-0 bg-gradient-to-br from-accent/3 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-accent/15 to-accent/5 border border-accent/10 group-hover:scale-105 transition-transform duration-300">
                      <MapPin className="h-5 w-5 text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-muted-foreground mb-1">Active Rounds</p>
                      <div className="flex items-baseline space-x-2">
                        <span className="text-2xl font-bold bg-gradient-to-r from-foreground to-accent bg-clip-text text-transparent">{roundsData?.active || 0}</span>
                        <span className="text-sm text-muted-foreground font-medium">/ {roundsData?.total || 0}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="group relative overflow-hidden bg-gradient-to-br from-card via-card to-card/50 border border-border/50 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/3 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/10 group-hover:scale-105 transition-transform duration-300">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-muted-foreground mb-1">EOD Today</p>
                      <div className="flex items-baseline space-x-2">
                        <span className="text-2xl font-bold bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">{eodData?.today || 0}</span>
                        {(eodData?.pending || 0) > 0 && (
                          <Badge className="bg-gradient-to-r from-warning/20 to-warning/10 text-warning border-warning/30 text-xs px-2 py-0.5 h-5 shadow-sm">
                            {eodData.pending}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Luxury Main Dashboard Widgets Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
              
              {/* Company Overview Widget */}
              <Card className="group relative overflow-hidden bg-gradient-to-br from-card via-card/95 to-card/90 border-0 shadow-xl hover:shadow-2xl transition-all duration-500 hover:-translate-y-2">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/3 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="absolute top-0 right-0 w-20 h-20 bg-primary/5 rounded-full blur-2xl transform translate-x-10 -translate-y-10"></div>
                <CardHeader className="relative">
                  <CardTitle className="flex items-center text-foreground text-lg font-semibold">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 mr-3 group-hover:scale-110 transition-transform duration-300">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    Company Overview
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">Operations at a glance</CardDescription>
                </CardHeader>
                <CardContent className="relative">
                  <div className="space-y-5">
                    <div className="flex justify-between items-center p-3 rounded-xl bg-gradient-to-r from-muted/30 to-muted/20 backdrop-blur-sm">
                      <span className="text-sm font-medium text-muted-foreground">Active Drivers</span>
                      <span className="text-lg font-bold bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">{driversData?.active || 0}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 rounded-xl bg-gradient-to-r from-muted/30 to-muted/20 backdrop-blur-sm">
                      <span className="text-sm font-medium text-muted-foreground">Active Rounds</span>
                      <span className="text-lg font-bold bg-gradient-to-r from-foreground to-accent bg-clip-text text-transparent">{roundsData?.active || 0}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 rounded-xl bg-gradient-to-r from-muted/30 to-muted/20 backdrop-blur-sm">
                      <span className="text-sm font-medium text-muted-foreground">EOD Reports Today</span>
                      <span className="text-lg font-bold bg-gradient-to-r from-foreground to-secondary bg-clip-text text-transparent">{eodData?.today || 0}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 rounded-xl bg-gradient-to-r from-warning/10 to-warning/5 backdrop-blur-sm border border-warning/20">
                      <span className="text-sm font-medium text-muted-foreground">Pending Approvals</span>
                      <span className="text-lg font-bold text-warning">{eodData?.pending || 0}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Driver Performance Widget */}
              <Card className="group relative overflow-hidden bg-gradient-to-br from-card via-card/95 to-card/90 border-0 shadow-xl hover:shadow-2xl transition-all duration-500 hover:-translate-y-2">
                <div className="absolute inset-0 bg-gradient-to-br from-secondary/3 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="absolute top-0 right-0 w-20 h-20 bg-secondary/5 rounded-full blur-2xl transform translate-x-10 -translate-y-10"></div>
                <CardHeader className="relative">
                  <CardTitle className="flex items-center text-foreground text-lg font-semibold">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-secondary/20 to-secondary/10 mr-3 group-hover:scale-110 transition-transform duration-300">
                      <TrendingUp className="h-5 w-5 text-secondary" />
                    </div>
                    Driver Performance
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">Weekly performance metrics</CardDescription>
                </CardHeader>
                <CardContent className="relative">
                  <div className="space-y-5">
                    <div className="flex justify-between items-center p-3 rounded-xl bg-gradient-to-r from-muted/30 to-muted/20 backdrop-blur-sm">
                      <span className="text-sm font-medium text-muted-foreground">Total Deliveries</span>
                      <span className="text-lg font-bold bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">{performanceData?.totalDelivered || 0}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 rounded-xl bg-gradient-to-r from-success/10 to-success/5 backdrop-blur-sm border border-success/20">
                      <span className="text-sm font-medium text-muted-foreground">Success Rate</span>
                      <span className="text-lg font-bold text-success">98.5%</span>
                    </div>
                    <div className="flex justify-between items-center p-3 rounded-xl bg-gradient-to-r from-muted/30 to-muted/20 backdrop-blur-sm">
                      <span className="text-sm font-medium text-muted-foreground">Support Parcels</span>
                      <span className="text-lg font-bold bg-gradient-to-r from-foreground to-accent bg-clip-text text-transparent">127</span>
                    </div>
                    <div className="flex justify-between items-center p-3 rounded-xl bg-gradient-to-r from-muted/30 to-muted/20 backdrop-blur-sm">
                      <span className="text-sm font-medium text-muted-foreground">Avg. Daily Rate</span>
                      <span className="text-lg font-bold bg-gradient-to-r from-foreground to-secondary bg-clip-text text-transparent">{performanceData?.avgDeliveryRate || 0}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Finance Overview Widget */}
              <Card className="group relative overflow-hidden bg-gradient-to-br from-card via-card/95 to-card/90 border-0 shadow-xl hover:shadow-2xl transition-all duration-500 hover:-translate-y-2">
                <div className="absolute inset-0 bg-gradient-to-br from-accent/3 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="absolute top-0 right-0 w-20 h-20 bg-accent/5 rounded-full blur-2xl transform translate-x-10 -translate-y-10"></div>
                <CardHeader className="relative">
                  <CardTitle className="flex items-center text-foreground text-lg font-semibold">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-accent/20 to-accent/10 mr-3 group-hover:scale-110 transition-transform duration-300">
                      <DollarSign className="h-5 w-5 text-accent" />
                    </div>
                    Finance Overview
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">Monthly financial summary</CardDescription>
                </CardHeader>
                <CardContent className="relative space-y-5">
                  <div className="flex justify-between items-center p-3 rounded-xl bg-gradient-to-r from-muted/30 to-muted/20 backdrop-blur-sm">
                    <span className="text-sm font-medium text-muted-foreground">Monthly Invoices</span>
                    <span className="text-lg font-bold bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">£{performanceData?.totalPay?.toFixed(2) || '0.00'}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-xl bg-gradient-to-r from-destructive/10 to-destructive/5 backdrop-blur-sm border border-destructive/20">
                    <span className="text-sm font-medium text-muted-foreground">Expenses</span>
                    <span className="text-lg font-bold text-destructive">£2,450.00</span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-xl bg-gradient-to-r from-success/10 to-success/5 backdrop-blur-sm border border-success/20">
                    <span className="text-sm font-medium text-muted-foreground">Net P&L</span>
                    <span className="text-lg font-bold text-success">+£8,750.00</span>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full mt-4 bg-gradient-to-r from-accent/10 to-accent/5 border-accent/30 hover:from-accent/20 hover:to-accent/10 transition-all duration-300"
                    onClick={() => navigate('/admin/finance')}
                  >
                    <DollarSign className="h-4 w-4 mr-2" />
                    View Finance
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Luxury Second Row Widgets */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
              
              {/* Schedule & Round Assignment Widget */}
              <Card className="group relative overflow-hidden bg-gradient-to-br from-card via-card/95 to-card/90 border-0 shadow-xl hover:shadow-2xl transition-all duration-500 hover:-translate-y-2">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/3 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl transform translate-x-12 -translate-y-12"></div>
                <CardHeader className="relative">
                  <CardTitle className="flex items-center text-foreground text-lg font-semibold">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 mr-3 group-hover:scale-110 transition-transform duration-300">
                      <Calendar className="h-5 w-5 text-primary" />
                    </div>
                    Schedule & Routes
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">Today's assignments and planning</CardDescription>
                </CardHeader>
                <CardContent className="relative">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-4 rounded-xl bg-gradient-to-r from-success/10 to-success/5 backdrop-blur-sm border border-success/20">
                      <div>
                        <p className="font-semibold text-foreground">Today's Assignments</p>
                        <p className="text-sm text-muted-foreground">{driversData?.active || 0} drivers scheduled</p>
                      </div>
                      <CheckCircle className="h-6 w-6 text-success" />
                    </div>
                    <div className="flex justify-between items-center p-4 rounded-xl bg-gradient-to-r from-warning/10 to-warning/5 backdrop-blur-sm border border-warning/20">
                      <div>
                        <p className="font-semibold text-foreground">Unassigned Rounds</p>
                        <p className="text-sm text-muted-foreground">2 rounds need assignment</p>
                      </div>
                      <AlertTriangle className="h-6 w-6 text-warning" />
                    </div>
                    <Button 
                      variant="outline" 
                      className="w-full mt-4 bg-gradient-to-r from-primary/10 to-primary/5 border-primary/30 hover:from-primary/20 hover:to-primary/10 transition-all duration-300"
                      onClick={() => navigate('/admin/schedule')}
                    >
                      <Calendar className="h-4 w-4 mr-2" />
                      Manage Schedule
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Driver Status Widget */}
              <Card className="group relative overflow-hidden bg-gradient-to-br from-card via-card/95 to-card/90 border-0 shadow-xl hover:shadow-2xl transition-all duration-500 hover:-translate-y-2">
                <div className="absolute inset-0 bg-gradient-to-br from-secondary/3 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="absolute top-0 right-0 w-24 h-24 bg-secondary/5 rounded-full blur-2xl transform translate-x-12 -translate-y-12"></div>
                <CardHeader className="relative">
                  <CardTitle className="flex items-center text-foreground text-lg font-semibold">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-secondary/20 to-secondary/10 mr-3 group-hover:scale-110 transition-transform duration-300">
                      <FileText className="h-5 w-5 text-secondary" />
                    </div>
                    Driver Status
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">Onboarding and document status</CardDescription>
                </CardHeader>
                <CardContent className="relative">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-4 rounded-xl bg-gradient-to-r from-warning/10 to-warning/5 backdrop-blur-sm border border-warning/20">
                      <div>
                        <p className="font-semibold text-foreground">Pending Onboarding</p>
                        <p className="text-sm text-muted-foreground">3 drivers need completion</p>
                      </div>
                      <Badge className="bg-gradient-to-r from-warning/30 to-warning/20 text-warning border-warning/40 px-3 py-1 text-sm font-medium shadow-sm">3</Badge>
                    </div>
                    <div className="flex justify-between items-center p-4 rounded-xl bg-gradient-to-r from-destructive/10 to-destructive/5 backdrop-blur-sm border border-destructive/20">
                      <div>
                        <p className="font-semibold text-foreground">Document Expiry</p>
                        <p className="text-sm text-muted-foreground">1 license expires soon</p>
                      </div>
                      <Badge className="bg-gradient-to-r from-destructive/30 to-destructive/20 text-destructive border-destructive/40 px-3 py-1 text-sm font-medium shadow-sm">1</Badge>
                    </div>
                    <Button 
                      variant="outline" 
                      className="w-full mt-4 bg-gradient-to-r from-secondary/10 to-secondary/5 border-secondary/30 hover:from-secondary/20 hover:to-secondary/10 transition-all duration-300"
                      onClick={() => navigate('/admin/drivers')}
                    >
                      <Users className="h-4 w-4 mr-2" />
                      Manage Drivers
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Luxury News & Communication Widget */}
            <Card className="group relative overflow-hidden bg-gradient-to-br from-card via-card/95 to-card/90 border-0 shadow-xl hover:shadow-2xl transition-all duration-500 hover:-translate-y-2">
              <div className="absolute inset-0 bg-gradient-to-br from-accent/3 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full blur-3xl transform translate-x-16 -translate-y-16"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl transform -translate-x-12 translate-y-12"></div>
              
              <CardHeader className="relative">
                <CardTitle className="flex items-center text-foreground text-lg font-semibold">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-accent/20 to-accent/10 mr-3 group-hover:scale-110 transition-transform duration-300">
                    <Activity className="h-5 w-5 text-accent" />
                  </div>
                  News & Communication
                </CardTitle>
                <CardDescription className="text-muted-foreground">Company announcements and chat management</CardDescription>
              </CardHeader>
              <CardContent className="relative">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="font-semibold text-foreground text-base">Recent Activity</h4>
                    <div className="space-y-3">
                      {eodData?.recent?.slice(0, 3).map((report, index) => (
                        <div key={report.id} className="flex items-center space-x-3 p-3 rounded-xl bg-gradient-to-r from-muted/30 to-muted/20 backdrop-blur-sm border border-muted/30">
                          <div className="w-3 h-3 rounded-full bg-gradient-to-r from-primary to-primary/70 animate-pulse"></div>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-foreground">{report.driver_name}</p>
                            <p className="text-xs text-muted-foreground">
                              Submitted EOD: {report.parcels_delivered} parcels
                            </p>
                          </div>
                          {getStatusBadge(report.status)}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h4 className="font-semibold text-foreground text-base">Quick Actions</h4>
                    <div className="space-y-3">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full justify-start bg-gradient-to-r from-primary/10 to-primary/5 border-primary/30 hover:from-primary/20 hover:to-primary/10 transition-all duration-300"
                        onClick={() => navigate('/admin/announcements')}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Create Announcement
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full justify-start bg-gradient-to-r from-accent/10 to-accent/5 border-accent/30 hover:from-accent/20 hover:to-accent/10 transition-all duration-300"
                        onClick={() => navigate('/admin/chat')}
                      >
                        <Activity className="h-4 w-4 mr-2" />
                        View Chat History
                      </Button>
                    </div>
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