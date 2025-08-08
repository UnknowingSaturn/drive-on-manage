import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Truck, Users, MapPin, Calendar, Bell, Clock, CheckCircle2, AlertTriangle, DollarSign, Star, Trophy, Receipt } from 'lucide-react';
import EarningsWidget from '@/components/driver/EarningsWidget';
import LeaderboardWidget from '@/components/driver/LeaderboardWidget';
import FeedbackWidget from '@/components/driver/FeedbackWidget';
import ExpenseWidget from '@/components/driver/ExpenseWidget';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { MobileNav } from '@/components/MobileNav';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const Dashboard = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const isAdmin = profile?.user_type === 'admin';
  const isDriver = profile?.user_type === 'driver';

  // Redirect admins to admin dashboard
  useEffect(() => {
    if (isAdmin) {
      navigate('/admin/dashboard', { replace: true });
    }
  }, [isAdmin, navigate]);

  // Get today's SOD log for drivers
  const { data: todaySOD } = useQuery({
    queryKey: ['today-sod-log', user?.id],
    queryFn: async () => {
      if (!user?.id || !isDriver) return null;
      
      const { data: driverProfile } = await supabase
        .from('driver_profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();
      
      if (driverProfile) {
        const today = new Date().toISOString().split('T')[0];
        const { data } = await supabase
          .from('sod_logs')
          .select('*')
          .eq('driver_id', driverProfile.id)
          .eq('log_date', today)
          .maybeSingle();
        return data;
      }
      return null;
    },
    enabled: !!user?.id && isDriver,
  });

  // Get today's EOD report for drivers
  const { data: todayEOD } = useQuery({
    queryKey: ['today-eod-report', user?.id],
    queryFn: async () => {
      if (!user?.id || !isDriver) return null;
      
      const { data: driverProfile } = await supabase
        .from('driver_profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();
      
      if (driverProfile) {
        const today = new Date().toISOString().split('T')[0];
        const { data } = await supabase
          .from('eod_reports')
          .select('*')
          .eq('driver_id', driverProfile.id)
          .eq('log_date', today)
          .maybeSingle();
        return data;
      }
      return null;
    },
    enabled: !!user?.id && isDriver,
  });

  if (isAdmin) {
    return null; // Will redirect to admin dashboard
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background no-overflow">
        <AppSidebar />
        
        <SidebarInset className="flex-1 no-overflow">
          {/* Header */}
          <header className="border-b bg-card sticky top-0 z-10">
            <div className="flex items-center justify-between mobile-padding py-3 md:py-4">
              <div className="flex items-center space-x-3">
                <SidebarTrigger className="mr-2 hidden md:flex" />
                <MobileNav className="md:hidden" />
                <div>
                  <h1 className="mobile-heading font-semibold text-foreground">
                    Driver Dashboard
                  </h1>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    Welcome back, {profile?.first_name || user?.email}
                  </p>
                </div>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="mobile-padding py-4 md:py-6">
        {isDriver && (
          <div className="space-y-6 md:space-y-8 animate-fade-in">
            <div>
              <h2 className="mobile-heading font-bold mb-2 text-gradient">Driver Dashboard</h2>
              <p className="mobile-text text-muted-foreground">
                Your daily logistics operations
              </p>
            </div>

            {/* Today's Status */}
            <Card className="logistics-card bg-gradient-dark">
              <CardHeader>
                <CardTitle className="flex items-center text-gradient">
                  <Truck className="h-5 w-5 text-primary mr-2 animate-truck-drive" />
                  Today's Status
                </CardTitle>
                <CardDescription>
                  Overview of your current shift
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
                  <div className="text-center p-4 rounded-lg bg-card/50 hover-lift">
                    <div className="text-2xl font-bold text-gradient">
                      {todaySOD?.parcel_count || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">Parcels Assigned</div>
                    <div className="flex items-center justify-center mt-2">
                      {todaySOD ? (
                        <div className="flex items-center text-success">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          <span className="text-xs">Day Started</span>
                        </div>
                      ) : (
                        <div className="flex items-center text-muted-foreground">
                          <Clock className="h-3 w-3 mr-1" />
                          <span className="text-xs">Not Started</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-center p-4 rounded-lg bg-card/50 hover-lift">
                    <div className="text-2xl font-bold text-success">
                      {todayEOD?.parcels_delivered || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">Delivered</div>
                    <div className="flex items-center justify-center mt-2">
                      {todayEOD ? (
                        <div className="flex items-center text-success">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          <span className="text-xs">Day Completed</span>
                        </div>
                      ) : (
                        <div className="flex items-center text-muted-foreground">
                          <Clock className="h-3 w-3 mr-1" />
                          <span className="text-xs">In Progress</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-center p-4 rounded-lg bg-card/50 hover-lift">
                    <div className="text-2xl font-bold text-gradient">
                      £{todayEOD?.estimated_pay?.toFixed(2) || '0.00'}
                    </div>
                    <div className="text-sm text-muted-foreground">Estimated Pay</div>
                    <div className="flex items-center justify-center mt-2">
                      <div className="w-2 h-2 bg-success rounded-full mr-2 animate-pulse"></div>
                      <span className="text-xs text-success">
                        {todayEOD?.status || 'Pending'}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Driver Quick Actions with Enhanced Effects */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <Card className="logistics-card hover-lift click-shrink group">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Clock className="h-5 w-5 text-primary mr-2" />
                    Start of Day
                    {todaySOD && (
                      <CheckCircle2 className="h-4 w-4 text-success ml-2" />
                    )}
                  </CardTitle>
                  <CardDescription>
                    Log your parcel count and vehicle check
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    className="logistics-button w-full group-hover:shadow-glow mobile-button"
                    onClick={() => navigate('/driver/start-of-day')}
                    disabled={!!todaySOD}
                  >
                    <Clock className="h-4 w-4 mr-2" />
                    {todaySOD ? 'Day Started' : 'Start My Day'}
                  </Button>
                </CardContent>
              </Card>

              <Card className="logistics-card hover-lift click-shrink group">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <CheckCircle2 className="h-5 w-5 text-primary mr-2" />
                    End of Day
                    {todayEOD && (
                      <CheckCircle2 className="h-4 w-4 text-success ml-2" />
                    )}
                  </CardTitle>
                  <CardDescription>
                    Complete your day and log deliveries
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    className="logistics-button w-full group-hover:shadow-glow mobile-button"
                    onClick={() => navigate('/driver/end-of-day')}
                    disabled={!todaySOD || !!todayEOD}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    {todayEOD ? 'Day Completed' : 'End My Day'}
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
                  <Button 
                    className="logistics-button w-full group-hover:shadow-glow mobile-button"
                    onClick={() => navigate('/driver/vehicle-check')}
                  >
                    <Truck className="h-4 w-4 mr-2" />
                    Vehicle Check
                  </Button>
                </CardContent>
              </Card>

              <Card className="logistics-card hover-lift click-shrink group">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <AlertTriangle className="h-5 w-5 text-warning mr-2" />
                    Incident Report
                  </CardTitle>
                  <CardDescription>
                    Report any incidents or issues
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    className="w-full border-warning/30 text-warning hover:bg-warning/10 mobile-button" 
                    variant="outline"
                    onClick={() => navigate('/driver/incident-report')}
                  >
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Report Incident
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Integrated Driver Features */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <EarningsWidget />
              <LeaderboardWidget />
              <FeedbackWidget />
              <ExpenseWidget />
            </div>
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