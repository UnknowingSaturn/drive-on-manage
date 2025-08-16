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
            <div className="saas-container flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <SidebarTrigger className="mobile-hidden" />
                <MobileNav className="md:hidden" />
                <div>
                  <h1 className="saas-title">Driver Dashboard</h1>
                  <p className="saas-subtitle">Welcome back, {profile?.first_name || user?.email}</p>
                </div>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="saas-main">
            <div className="saas-container">
              {isDriver && (
                <div className="space-y-6 animate-fade-in">
                  {/* Today's Status */}
                  <div className="saas-card">
                    <div className="saas-card-header">
                      <div className="flex items-center gap-2">
                        <Truck className="h-5 w-5 text-primary" />
                        <h2 className="saas-heading">Today's Status</h2>
                      </div>
                      <p className="saas-subtitle">Overview of your current shift</p>
                    </div>
                    <div className="saas-card-content">
                      <div className="mobile-grid">
                        <div className="saas-metric">
                          <div className="saas-metric-value">{todaySOD?.parcel_count || 0}</div>
                          <div className="saas-metric-label">Parcels Assigned</div>
                          <div className="flex items-center justify-center mt-2">
                            {todaySOD ? (
                              <span className="saas-status saas-status-success">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Day Started
                              </span>
                            ) : (
                              <span className="saas-status saas-status-info">
                                <Clock className="h-3 w-3 mr-1" />
                                Not Started
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div className="saas-metric">
                          <div className="saas-metric-value text-success">
                            {todayEOD?.total_parcels || (todayEOD?.successful_deliveries + todayEOD?.successful_collections + todayEOD?.support_parcels) || 0}
                          </div>
                          <div className="saas-metric-label">Delivered</div>
                          <div className="flex items-center justify-center mt-2">
                            {todayEOD ? (
                              <span className="saas-status saas-status-success">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Day Completed
                              </span>
                            ) : (
                              <span className="saas-status saas-status-warning">
                                <Clock className="h-3 w-3 mr-1" />
                                In Progress
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div className="saas-metric">
                          <div className="saas-metric-value">£0.00</div>
                          <div className="saas-metric-label">Estimated Pay</div>
                          <div className="flex items-center justify-center mt-2">
                            <span className="saas-status saas-status-info">
                              {todayEOD ? 'Completed' : 'Pending'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="mobile-grid">
                    <div className="saas-card saas-hover">
                      <div className="saas-card-header">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-primary" />
                          <h3 className="saas-subheading">Start of Day</h3>
                          {todaySOD && <CheckCircle2 className="h-4 w-4 text-success" />}
                        </div>
                        <p className="saas-caption">Log your parcel count and vehicle check</p>
                      </div>
                      <div className="saas-card-content">
                        <Button 
                          className="saas-button saas-button-default w-full touch-target"
                          onClick={() => navigate('/driver/start-of-day')}
                          disabled={!!todaySOD}
                        >
                          <Clock className="h-4 w-4 mr-2" />
                          {todaySOD ? 'Day Started' : 'Start My Day'}
                        </Button>
                      </div>
                    </div>

                    <div className="saas-card saas-hover">
                      <div className="saas-card-header">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                          <h3 className="saas-subheading">End of Day</h3>
                          {todayEOD && <CheckCircle2 className="h-4 w-4 text-success" />}
                        </div>
                        <p className="saas-caption">Complete your day and log deliveries</p>
                      </div>
                      <div className="saas-card-content">
                        <Button 
                          className="saas-button saas-button-default w-full touch-target"
                          onClick={() => navigate('/driver/end-of-day')}
                          disabled={!!todayEOD}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          {todayEOD ? 'Day Completed' : 'End My Day'}
                        </Button>
                      </div>
                    </div>

                    <div className="saas-card saas-hover">
                      <div className="saas-card-header">
                        <div className="flex items-center gap-2">
                          <Truck className="h-4 w-4 text-primary" />
                          <h3 className="saas-subheading">Vehicle Check</h3>
                        </div>
                        <p className="saas-caption">Perform and log your vehicle inspection</p>
                      </div>
                      <div className="saas-card-content">
                        <Button 
                          className="saas-button saas-button-default w-full touch-target"
                          onClick={() => navigate('/driver/vehicle-check')}
                        >
                          <Truck className="h-4 w-4 mr-2" />
                          Vehicle Check
                        </Button>
                      </div>
                    </div>

                    <div className="saas-card saas-hover">
                      <div className="saas-card-header">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-warning" />
                          <h3 className="saas-subheading">Incident Report</h3>
                        </div>
                        <p className="saas-caption">Report any incidents or issues</p>
                      </div>
                      <div className="saas-card-content">
                        <Button 
                          className="saas-button saas-button-outline w-full touch-target border-warning/30 text-warning hover:bg-warning/10"
                          onClick={() => navigate('/driver/incident-report')}
                        >
                          <AlertTriangle className="h-4 w-4 mr-2" />
                          Report Incident
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Driver Features */}
                  <div className="mobile-grid">
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