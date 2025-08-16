import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Truck, Users, MapPin, Calendar, Bell, Clock, CheckCircle2, AlertTriangle, DollarSign, Star, Trophy, Receipt } from 'lucide-react';
import EarningsWidget from '@/components/driver/EarningsWidget';
import LeaderboardWidget from '@/components/driver/LeaderboardWidget';
import FeedbackWidget from '@/components/driver/FeedbackWidget';
import ExpenseWidget from '@/components/driver/ExpenseWidget';
import EODModal from '@/components/driver/EODModal';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { MobileNav } from '@/components/MobileNav';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const Dashboard = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [eodModalOpen, setEodModalOpen] = React.useState(false);

  const isAdmin = profile?.user_type === 'admin';
  const isDriver = profile?.user_type === 'driver';

  console.log('Dashboard render:', { 
    userType: profile?.user_type, 
    isAdmin, 
    isDriver, 
    profile 
  });

  // Redirect admins to admin dashboard
  useEffect(() => {
    if (isAdmin) {
      console.log('Admin detected, redirecting to admin dashboard');
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

  // Get weekly assigned rounds for drivers
  const { data: weeklyRounds } = useQuery({
    queryKey: ['weekly-rounds', user?.id],
    queryFn: async () => {
      if (!user?.id || !isDriver) return null;
      
      const { data: driverProfile } = await supabase
        .from('driver_profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();
      
      if (driverProfile) {
        // Get this week's start and end dates
        const now = new Date();
        const weekStart = new Date(now.setDate(now.getDate() - now.getDay() + 1)); // Monday
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6); // Sunday
        
        const { data } = await supabase
          .from('schedules')
          .select(`
            id,
            scheduled_date,
            rounds(round_number, description)
          `)
          .eq('driver_id', driverProfile.id)
          .gte('scheduled_date', weekStart.toISOString().split('T')[0])
          .lte('scheduled_date', weekEnd.toISOString().split('T')[0])
          .eq('status', 'scheduled');
        
        return data || [];
      }
      return [];
    },
    enabled: !!user?.id && isDriver,
  });

  // Get today's EOD report for drivers (using new table)
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
          .from('end_of_day_reports')
          .select('*')
          .eq('driver_id', driverProfile.id)
          .gte('submitted_at', `${today}T00:00:00.000Z`)
          .lt('submitted_at', `${today}T23:59:59.999Z`)
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
      <div className="saas-page flex w-full">
        <AppSidebar />
        
        <SidebarInset className="flex-1">
          {/* Header */}
          <header className="border-b bg-card sticky top-0 z-10">
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <SidebarTrigger className="mobile-hidden" />
                <MobileNav className="md:hidden" />
                <div>
                  <h1 className="text-lg font-semibold">Driver Dashboard</h1>
                  <p className="text-xs text-muted-foreground">Welcome back, {profile?.first_name || user?.email}</p>
                </div>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="p-4 space-y-4">
            <div className="max-w-7xl mx-auto">
              {isDriver && (
                <div className="space-y-4 animate-fade-in">
                  {/* Today's Status - More Compact */}
                  <Card className="border-0 shadow-sm">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <Truck className="h-4 w-4 text-primary" />
                        <h2 className="text-lg font-semibold">Today's Status</h2>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="bg-card/50 p-3 rounded-lg">
                          <div className="text-xl font-bold text-primary">{weeklyRounds?.length || 0}</div>
                          <div className="text-xs text-muted-foreground">Rounds This Week</div>
                          <div className="flex items-center justify-center mt-1">
                            {weeklyRounds && weeklyRounds.length > 0 ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Scheduled
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-600">
                                <Clock className="h-3 w-3 mr-1" />
                                No Rounds
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div className="bg-card/50 p-3 rounded-lg">
                          <div className="text-xl font-bold text-success">
                            {todayEOD?.total_parcels || (todayEOD?.successful_deliveries + todayEOD?.successful_collections + todayEOD?.support_parcels) || 0}
                          </div>
                          <div className="text-xs text-muted-foreground">Delivered Today</div>
                          <div className="flex items-center justify-center mt-1">
                            {todayEOD ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Completed
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-800">
                                <Clock className="h-3 w-3 mr-1" />
                                In Progress
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div className="bg-card/50 p-3 rounded-lg">
                          <div className="text-xl font-bold">£0.00</div>
                          <div className="text-xs text-muted-foreground">Estimated Pay</div>
                          <div className="flex items-center justify-center mt-1">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                              {todayEOD ? 'Completed' : 'Pending'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Quick Actions - More Compact Grid */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <Card className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Clock className="h-4 w-4 text-primary" />
                          <h3 className="font-medium text-sm">Start of Day</h3>
                          {todaySOD && <CheckCircle2 className="h-4 w-4 text-success" />}
                        </div>
                        <p className="text-xs text-muted-foreground mb-3">Log parcel count & vehicle check</p>
                        <Button 
                          size="sm"
                          className="w-full h-8 text-xs"
                          onClick={() => navigate('/driver/start-of-day')}
                          disabled={!!todaySOD}
                        >
                          <Clock className="h-3 w-3 mr-1" />
                          {todaySOD ? 'Started' : 'Start Day'}
                        </Button>
                      </CardContent>
                    </Card>

                    <Card className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                          <h3 className="font-medium text-sm">End of Day</h3>
                          {todayEOD && <CheckCircle2 className="h-4 w-4 text-success" />}
                        </div>
                        <p className="text-xs text-muted-foreground mb-3">Complete day & log deliveries</p>
                        <Button 
                          size="sm"
                          className="w-full h-8 text-xs"
                          onClick={() => navigate('/driver/end-of-day')}
                          disabled={!!todayEOD}
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          {todayEOD ? 'Completed' : 'End Day'}
                        </Button>
                      </CardContent>
                    </Card>

                    <Card className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Truck className="h-4 w-4 text-primary" />
                          <h3 className="font-medium text-sm">Vehicle Check</h3>
                        </div>
                        <p className="text-xs text-muted-foreground mb-3">Perform vehicle inspection</p>
                        <Button 
                          size="sm"
                          className="w-full h-8 text-xs"
                          onClick={() => navigate('/driver/vehicle-check')}
                        >
                          <Truck className="h-3 w-3 mr-1" />
                          Check Vehicle
                        </Button>
                      </CardContent>
                    </Card>

                    <Card className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle className="h-4 w-4 text-warning" />
                          <h3 className="font-medium text-sm">Incident Report</h3>
                        </div>
                        <p className="text-xs text-muted-foreground mb-3">Report any incidents</p>
                        <Button 
                          size="sm"
                          variant="outline"
                          className="w-full h-8 text-xs border-warning/30 text-warning hover:bg-warning/10"
                          onClick={() => navigate('/driver/incident-report')}
                        >
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Report
                        </Button>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Driver Features - Compact Grid */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <EarningsWidget />
                    <LeaderboardWidget />
                    <FeedbackWidget />
                    <ExpenseWidget />
                  </div>
                </div>
              )}

              {!profile && (
                <div className="saas-card">
                  <div className="saas-card-header">
                    <h2 className="saas-heading">Setting up your profile...</h2>
                    <p className="saas-subtitle">Please wait while we configure your account</p>
                  </div>
                </div>
              )}
            </div>
          </main>
        </SidebarInset>
      </div>

      {/* EOD Modal */}
      <EODModal 
        open={eodModalOpen} 
        onOpenChange={setEodModalOpen} 
      />
    </SidebarProvider>
  );
};

export default Dashboard;