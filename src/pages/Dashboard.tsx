import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Truck, Users, MapPin, Calendar, Bell, Clock, CheckCircle2, AlertTriangle, DollarSign, Star, Trophy, Receipt, Route, Banknote } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import EarningsWidget from '@/components/driver/EarningsWidget';
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
          .from('start_of_day_reports')
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
            driver_rate,
            rounds(
              round_number, 
              description, 
              rate, 
              parcel_rate, 
              base_rate, 
              road_lists
            )
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
                          <div className="saas-metric-value">{weeklyRounds?.length || 0}</div>
                          <div className="saas-metric-label">Rounds This Week</div>
                          <div className="flex items-center justify-center mt-2">
                            {weeklyRounds && weeklyRounds.length > 0 ? (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="outline" size="sm" className="h-6 px-3 text-xs bg-success/10 border-success/30 text-success hover:bg-success/20">
                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                    View Schedule
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-80" align="center">
                                  <div className="space-y-3">
                                    <h4 className="font-semibold text-sm">Your Weekly Schedule</h4>
                                    <div className="space-y-2 max-h-60 overflow-y-auto">
                                      {weeklyRounds.map((schedule: any, index: number) => (
                                        <div key={index} className="border border-border rounded-lg p-3 bg-background hover:bg-muted/50 transition-colors">
                                          <div className="flex items-center justify-between mb-2">
                                            <div className="font-semibold text-sm text-primary">
                                              Round {schedule.rounds?.round_number || 'N/A'}
                                            </div>
                                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                              <Calendar className="h-3 w-3" />
                                              {new Date(schedule.scheduled_date).toLocaleDateString('en-GB', {
                                                weekday: 'short',
                                                day: 'numeric',
                                                month: 'short'
                                              })}
                                            </div>
                                          </div>
                                          {schedule.rounds?.description && (
                                            <div className="flex items-start gap-2">
                                              <MapPin className="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                                              <div className="text-xs text-muted-foreground leading-relaxed">
                                                {schedule.rounds.description}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            ) : (
                              <span className="saas-status saas-status-info">
                                <Clock className="h-3 w-3 mr-1" />
                                No Rounds
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
                    <div className="saas-card saas-hover">
                      <div className="saas-card-header">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-primary" />
                          <h3 className="saas-subheading">Rounds Assigned</h3>
                        </div>
                        <p className="saas-caption">View your weekly round assignments</p>
                      </div>
                      <div className="saas-card-content">
                        <div className="saas-metric mb-3">
                          <div className="saas-metric-value">{weeklyRounds?.length || 0}</div>
                          <div className="saas-metric-label">This Week</div>
                        </div>
                        {weeklyRounds && weeklyRounds.length > 0 ? (
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button className="saas-button saas-button-default w-full touch-target">
                                <MapPin className="h-4 w-4 mr-2" />
                                View Details
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-96" align="center">
                              <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                  <MapPin className="h-5 w-5 text-primary" />
                                  <h4 className="font-semibold">Your Weekly Schedule</h4>
                                </div>
                                <div className="space-y-3 max-h-80 overflow-y-auto">
                                  {weeklyRounds.map((schedule: any, index: number) => (
                                    <div key={index} className="border border-border rounded-lg p-4 bg-background hover:bg-muted/50 transition-colors">
                                      <div className="flex items-center justify-between mb-3">
                                        <div className="font-semibold text-primary">
                                          Round {schedule.rounds?.round_number || 'N/A'}
                                        </div>
                                        <div className="flex items-center gap-1 text-sm text-muted-foreground bg-muted px-2 py-1 rounded">
                                          <Calendar className="h-3 w-3" />
                                          {new Date(schedule.scheduled_date).toLocaleDateString('en-GB', {
                                            weekday: 'long',
                                            day: 'numeric',
                                            month: 'short'
                                          })}
                                        </div>
                                      </div>
                                      
                                      {/* Location/Description */}
                                      {schedule.rounds?.description && (
                                        <div className="flex items-start gap-2 mb-3">
                                          <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                                          <div className="text-sm text-muted-foreground leading-relaxed">
                                            <strong>Location:</strong> {schedule.rounds.description}
                                          </div>
                                        </div>
                                      )}

                                      {/* Route Rate */}
                                      <div className="flex items-center gap-2 mb-3">
                                        <Banknote className="h-4 w-4 text-muted-foreground" />
                                        <div className="text-sm">
                                          <strong>Rate:</strong> 
                                          {schedule.rounds?.rate ? (
                                            <Badge variant="secondary" className="ml-2">
                                              £{schedule.rounds.rate}/parcel
                                            </Badge>
                                          ) : schedule.rounds?.parcel_rate ? (
                                            <Badge variant="outline" className="ml-2">
                                              £{schedule.rounds.parcel_rate}/parcel
                                            </Badge>
                                          ) : schedule.rounds?.base_rate ? (
                                            <Badge variant="outline" className="ml-2">
                                              £{schedule.rounds.base_rate}/day
                                            </Badge>
                                          ) : (
                                            <span className="text-muted-foreground ml-2">No rate set</span>
                                          )}
                                        </div>
                                      </div>

                                      {/* Road Lists */}
                                      {schedule.rounds?.road_lists && schedule.rounds.road_lists.length > 0 && (
                                        <div className="mb-3">
                                          <div className="flex items-center gap-2 mb-2">
                                            <Route className="h-4 w-4 text-muted-foreground" />
                                            <strong className="text-sm">Roads:</strong>
                                          </div>
                                          <div className="grid grid-cols-1 gap-1 ml-6">
                                            {schedule.rounds.road_lists.slice(0, 3).map((road: string, roadIndex: number) => (
                                              <div key={roadIndex} className="text-xs bg-muted/50 px-2 py-1 rounded flex items-center gap-1">
                                                <span className="w-4 h-4 bg-primary/10 text-primary rounded-full flex items-center justify-center text-[10px] font-medium">
                                                  {roadIndex + 1}
                                                </span>
                                                {road}
                                              </div>
                                            ))}
                                            {schedule.rounds.road_lists.length > 3 && (
                                              <div className="text-xs text-muted-foreground italic">
                                                +{schedule.rounds.road_lists.length - 3} more roads
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      )}

                                      {/* Assignment Details */}
                                      <div className="flex items-center justify-between text-xs pt-2 border-t">
                                        <div className="text-muted-foreground">
                                          Your Rate: £{schedule.driver_rate || '0.00'}/parcel
                                        </div>
                                        <span className="bg-success/10 text-success px-2 py-1 rounded">
                                          Scheduled
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>
                        ) : (
                          <Button className="saas-button saas-button-outline w-full touch-target" disabled>
                            <Clock className="h-4 w-4 mr-2" />
                            No Rounds Assigned
                          </Button>
                        )}
                      </div>
                    </div>
                     
                     <EarningsWidget />
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