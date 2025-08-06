import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Truck, Users, MapPin, Calendar, Bell } from 'lucide-react';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const Dashboard = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const isAdmin = profile?.user_type === 'admin';
  const isDriver = profile?.user_type === 'driver';

  // Fetch real-time data for admin dashboard
  const { data: driversCount } = useQuery({
    queryKey: ['active-drivers-count', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id || !isAdmin) return 0;
      const { count } = await supabase
        .from('driver_profiles')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', profile.company_id)
        .eq('status', 'active');
      return count || 0;
    },
    enabled: !!profile?.company_id && isAdmin,
  });

  const { data: vansCount } = useQuery({
    queryKey: ['active-vans-count', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id || !isAdmin) return 0;
      const { count } = await supabase
        .from('vans')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', profile.company_id)
        .eq('is_active', true);
      return count || 0;
    },
    enabled: !!profile?.company_id && isAdmin,
  });

  const { data: roundsCount } = useQuery({
    queryKey: ['active-rounds-count', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id || !isAdmin) return 0;
      const { count } = await supabase
        .from('rounds')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', profile.company_id)
        .eq('is_active', true);
      return count || 0;
    },
    enabled: !!profile?.company_id && isAdmin,
  });

  const { data: todayLogs } = useQuery({
    queryKey: ['today-logs', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return null;
      const today = new Date().toISOString().split('T')[0];
      
      if (isAdmin) {
        const { data } = await supabase
          .from('daily_logs')
          .select('*')
          .eq('company_id', profile.company_id)
          .eq('log_date', today);
        return data || [];
      } else if (isDriver) {
        const { data: driverProfile } = await supabase
          .from('driver_profiles')
          .select('id')
          .eq('user_id', user?.id)
          .single();
        
        if (driverProfile) {
          const { data } = await supabase
            .from('daily_logs')
            .select('*')
            .eq('driver_id', driverProfile.id)
            .eq('log_date', today)
            .single();
          return data;
        }
      }
      return null;
    },
    enabled: !!profile?.company_id && !!user?.id,
  });

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        
        <SidebarInset className="flex-1">
          {/* Header */}
          <header className="border-b bg-card sticky top-0 z-10">
            <div className="flex items-center px-4 py-4">
              <SidebarTrigger className="mr-4" />
              <div className="flex items-center space-x-3">
                <div>
                  <h1 className="text-xl font-semibold text-foreground">
                    {isAdmin ? 'Admin Dashboard' : 'Driver Dashboard'}
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Welcome back, {profile?.first_name || user?.email}
                  </p>
                </div>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="p-6">
        {isAdmin && (
          <div className="space-y-8">
            <div>
              <h2 className="text-3xl font-bold mb-2">Admin Dashboard</h2>
              <p className="text-muted-foreground">
                Manage your logistics operations from here
              </p>
            </div>

            {/* Admin Overview Cards with Logistics Effects */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="logistics-card hover-lift">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Drivers</CardTitle>
                  <div className="truck-animation">
                    <Users className="h-4 w-4 text-primary" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gradient">{driversCount || 0}</div>
                  <div className="text-xs text-muted-foreground flex items-center">
                    <div className="w-2 h-2 bg-success rounded-full mr-2 animate-pulse"></div>
                    Currently active
                  </div>
                </CardContent>
              </Card>

              <Card className="logistics-card hover-lift route-indicator">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Vans</CardTitle>
                  <div className="truck-animation">
                    <Truck className="h-4 w-4 text-primary animate-truck-drive" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gradient">{vansCount || 0}</div>
                  <div className="text-xs text-muted-foreground flex items-center">
                    <div className="w-2 h-2 bg-success rounded-full mr-2"></div>
                    Vehicles available
                  </div>
                </CardContent>
              </Card>

              <Card className="logistics-card hover-lift">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Today's Rounds</CardTitle>
                  <MapPin className="h-4 w-4 text-primary animate-float" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gradient">{roundsCount || 0}</div>
                  <div className="text-xs text-muted-foreground">
                    <span className="delivery-status status-delivered mr-1">Configured rounds</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="logistics-card hover-lift logistics-glow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pending Actions</CardTitle>
                  <Bell className="h-4 w-4 text-warning animate-pulse" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-warning">{Array.isArray(todayLogs) ? todayLogs.filter(log => log.status === 'in_progress').length : 0}</div>
                  <div className="text-xs text-muted-foreground">
                    Active logs today
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions with Enhanced Styling */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card className="logistics-card hover-lift click-shrink group">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Users className="h-5 w-5 text-primary mr-2 truck-animation" />
                    Driver Management
                  </CardTitle>
                  <CardDescription>
                    Add, edit, and manage your driver workforce
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    className="logistics-button w-full group-hover:shadow-glow" 
                    onClick={() => navigate('/admin/drivers')}
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Manage Drivers
                  </Button>
                </CardContent>
              </Card>

              <Card className="logistics-card hover-lift click-shrink group">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Truck className="h-5 w-5 text-primary mr-2 animate-truck-drive" />
                    Vehicle Management
                  </CardTitle>
                  <CardDescription>
                    Track and maintain your fleet of vehicles
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    className="logistics-button w-full group-hover:shadow-glow" 
                    onClick={() => navigate('/admin/vans')}
                  >
                    <Truck className="h-4 w-4 mr-2" />
                    Manage Vehicles
                  </Button>
                </CardContent>
              </Card>

              <Card className="logistics-card hover-lift click-shrink group">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Calendar className="h-5 w-5 text-primary mr-2 animate-float" />
                    Schedule & Rounds
                  </CardTitle>
                  <CardDescription>
                    Plan and assign delivery rounds
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    className="logistics-button w-full group-hover:shadow-glow" 
                    onClick={() => navigate('/admin/schedule')}
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    View Schedule
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {isDriver && (
          <div className="space-y-8 animate-fade-in">
            <div>
              <h2 className="text-3xl font-bold mb-2 text-gradient">Driver Dashboard</h2>
              <p className="text-muted-foreground">
                Your daily logistics operations
              </p>
            </div>

            {/* Driver Quick Actions with Enhanced Effects */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="logistics-card hover-lift click-shrink group">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Calendar className="h-5 w-5 text-primary mr-2 animate-float" />
                    Start of Day
                  </CardTitle>
                  <CardDescription>
                    Log your parcel count and vehicle check
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="logistics-button w-full group-hover:shadow-glow">
                    <Calendar className="h-4 w-4 mr-2" />
                    Start My Day
                  </Button>
                </CardContent>
              </Card>

              <Card className="logistics-card hover-lift click-shrink group">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <MapPin className="h-5 w-5 text-primary mr-2 animate-float" />
                    End of Day
                  </CardTitle>
                  <CardDescription>
                    Complete your day and log deliveries
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="logistics-button w-full group-hover:shadow-glow">
                    <MapPin className="h-4 w-4 mr-2" />
                    End My Day
                  </Button>
                </CardContent>
              </Card>

              <Card className="logistics-card hover-lift click-shrink group">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Truck className="h-5 w-5 text-primary mr-2 animate-truck-drive" />
                    Vehicle Check
                  </CardTitle>
                  <CardDescription>
                    Perform and log your vehicle inspection
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="logistics-button w-full group-hover:shadow-glow">
                    <Truck className="h-4 w-4 mr-2" />
                    Vehicle Check
                  </Button>
                </CardContent>
              </Card>

              <Card className="logistics-card hover-lift click-shrink group">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Bell className="h-5 w-5 text-warning mr-2 animate-pulse" />
                    Incident Report
                  </CardTitle>
                  <CardDescription>
                    Report any incidents or issues
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full border-warning/30 text-warning hover:bg-warning/10" variant="outline">
                    <Bell className="h-4 w-4 mr-2" />
                    Report Incident
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Today's Summary with Enhanced Styling */}
            <Card className="logistics-card bg-gradient-dark">
              <CardHeader>
                <CardTitle className="flex items-center text-gradient">
                  <Truck className="h-5 w-5 text-primary mr-2 animate-truck-drive" />
                  Today's Summary
                </CardTitle>
                <CardDescription>
                  Overview of your current shift
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 rounded-lg bg-card/50 hover-lift">
                    <div className="text-2xl font-bold text-gradient">
                      {todayLogs && !Array.isArray(todayLogs) ? todayLogs.sod_parcel_count || 0 : 0}
                    </div>
                    <div className="text-sm text-muted-foreground">Parcels Assigned</div>
                    <div className="w-full bg-muted rounded-full h-2 mt-2">
                      <div className="bg-gradient-primary h-2 rounded-full w-3/4 route-indicator"></div>
                    </div>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-card/50 hover-lift">
                    <div className="text-2xl font-bold text-success">
                      {todayLogs && !Array.isArray(todayLogs) ? todayLogs.eod_delivered_count || 0 : 0}
                    </div>
                    <div className="text-sm text-muted-foreground">Delivered</div>
                    <div className="delivery-status status-delivered mt-2">
                      {todayLogs && !Array.isArray(todayLogs) && todayLogs.sod_parcel_count 
                        ? Math.round((todayLogs.eod_delivered_count || 0) / todayLogs.sod_parcel_count * 100) 
                        : 0}% Complete
                    </div>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-card/50 hover-lift">
                    <div className="text-2xl font-bold text-gradient">
                      £{todayLogs && !Array.isArray(todayLogs) ? todayLogs.estimated_pay || '0' : '0'}
                    </div>
                    <div className="text-sm text-muted-foreground">Estimated Pay</div>
                    <div className="flex items-center justify-center mt-2">
                      <div className="w-2 h-2 bg-success rounded-full mr-2 animate-pulse"></div>
                      <span className="text-xs text-success">
                        {todayLogs && !Array.isArray(todayLogs) ? todayLogs.status || 'Not started' : 'Not started'}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {!profile && (
          <Card>
            <CardHeader>
              <CardTitle>Setting up your profile...</CardTitle>
              <CardDescription>
                Please wait while we configure your account
              </CardDescription>
            </CardHeader>
          </Card>
        )}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default Dashboard;