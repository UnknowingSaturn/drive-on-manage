import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Package, 
  Clock, 
  CheckCircle2, 
  Truck, 
  DollarSign, 
  Bell, 
  AlertTriangle,
  Play,
  Square,
  MapPin,
  Calendar,
  TrendingUp,
  FileText
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

const DriverDashboard = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const today = new Date().toISOString().split('T')[0];

  // Get driver profile
  const { data: driverProfile } = useQuery({
    queryKey: ['driver-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('driver_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
      return data;
    },
    enabled: !!user?.id
  });

  // Get today's SOD status
  const { data: todaySOD } = useQuery({
    queryKey: ['today-sod', driverProfile?.id, today],
    queryFn: async () => {
      if (!driverProfile?.id) return null;
      const { data } = await supabase
        .from('sod_logs')
        .select('*')
        .eq('driver_id', driverProfile.id)
        .eq('log_date', today)
        .maybeSingle();
      return data;
    },
    enabled: !!driverProfile?.id
  });

  // Get today's EOD status
  const { data: todayEOD } = useQuery({
    queryKey: ['today-eod', driverProfile?.id, today],
    queryFn: async () => {
      if (!driverProfile?.id) return null;
      const { data } = await supabase
        .from('end_of_day_reports')
        .select('*')
        .eq('driver_id', driverProfile.id)
        .eq('submitted_at::date', today)
        .maybeSingle();
      return data;
    },
    enabled: !!driverProfile?.id
  });

  // Get assigned van
  const { data: assignedVan } = useQuery({
    queryKey: ['assigned-van', driverProfile?.assigned_van_id],
    queryFn: async () => {
      if (!driverProfile?.assigned_van_id) return null;
      const { data } = await supabase
        .from('vans')
        .select('*')
        .eq('id', driverProfile.assigned_van_id)
        .single();
      return data;
    },
    enabled: !!driverProfile?.assigned_van_id
  });

  // Get today's schedule
  const { data: todaySchedule } = useQuery({
    queryKey: ['today-schedule', driverProfile?.id, today],
    queryFn: async () => {
      if (!driverProfile?.id) return [];
      const { data } = await supabase
        .from('schedules')
        .select('*, round_id')
        .eq('driver_id', driverProfile.id)
        .eq('scheduled_date', today);
      return data || [];
    },
    enabled: !!driverProfile?.id
  });

  // Get recent announcements
  const { data: announcements } = useQuery({
    queryKey: ['announcements', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      const { data } = await supabase
        .from('announcements')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('is_active', true)
        .or(`target_audience.eq.all,target_audience.eq.drivers`)
        .order('created_at', { ascending: false })
        .limit(3);
      return data || [];
    },
    enabled: !!profile?.company_id
  });

  // Get recent earnings
  const { data: recentEarnings } = useQuery({
    queryKey: ['recent-earnings', driverProfile?.id],
    queryFn: async () => {
      if (!driverProfile?.id) return [];
      const { data } = await supabase
        .from('driver_earnings')
        .select('*')
        .eq('driver_id', driverProfile.id)
        .order('earning_date', { ascending: false })
        .limit(7);
      return data || [];
    },
    enabled: !!driverProfile?.id
  });

  const todayEarnings = recentEarnings?.find(e => e.earning_date === today);
  const weeklyEarnings = recentEarnings?.reduce((sum, e) => sum + Number(e.total_earnings), 0) || 0;

  return (
    <div className="saas-main">
      {/* Welcome Header */}
      <div className="mb-6">
        <h1 className="saas-title">
          Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'}, {profile?.first_name}
        </h1>
        <p className="saas-subtitle">
          {format(new Date(), 'EEEE, MMMM do, yyyy')}
        </p>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column - Primary Actions */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Today's Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Start of Day Card */}
            <Card className="saas-card">
              <CardHeader className="saas-card-header pb-3">
                <CardTitle className="saas-subheading flex items-center">
                  <Play className="h-4 w-4 text-primary mr-2" />
                  Start of Day
                </CardTitle>
              </CardHeader>
              <CardContent className="saas-card-content pt-0">
                {todaySOD ? (
                  <div className="space-y-2">
                    <Badge variant="default" className="w-full justify-center">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Completed at {new Date(todaySOD.timestamp).toLocaleTimeString()}
                    </Badge>
                    <div className="text-sm text-muted-foreground">
                      Parcels: {todaySOD.parcel_count}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">Ready to start your day?</p>
                    <Button 
                      onClick={() => navigate('/driver/start-of-day')}
                      className="w-full"
                      size="sm"
                    >
                      Start Day
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* End of Day Card */}
            <Card className="saas-card">
              <CardHeader className="saas-card-header pb-3">
                <CardTitle className="saas-subheading flex items-center">
                  <Square className="h-4 w-4 text-primary mr-2" />
                  End of Day
                </CardTitle>
              </CardHeader>
              <CardContent className="saas-card-content pt-0">
                {todayEOD ? (
                  <div className="space-y-2">
                    <Badge variant="default" className="w-full justify-center">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Submitted
                    </Badge>
                    <div className="text-sm text-muted-foreground">
                      Deliveries: {todayEOD.successful_deliveries}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">Complete your shift</p>
                    <Button 
                      onClick={() => navigate('/driver/end-of-day')}
                      variant="outline"
                      className="w-full"
                      size="sm"
                      disabled={!todaySOD}
                    >
                      End Day
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Today's Route Info */}
          <Card className="saas-card">
            <CardHeader className="saas-card-header">
              <CardTitle className="saas-heading flex items-center">
                <MapPin className="h-5 w-5 text-primary mr-2" />
                Today's Assignment
              </CardTitle>
            </CardHeader>
            <CardContent className="saas-card-content">
              {todaySchedule?.length > 0 ? (
                <div className="space-y-4">
                  {todaySchedule.map((schedule: any) => (
                    <div key={schedule.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                          <Package className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <div className="font-medium">Round {schedule.rounds?.round_number}</div>
                          <div className="text-sm text-muted-foreground">
                            Rate: £{schedule.rounds?.rate || schedule.driver_rate || 'TBD'} per parcel
                          </div>
                        </div>
                      </div>
                      <Badge variant={schedule.status === 'completed' ? 'default' : 'secondary'}>
                        {schedule.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No routes assigned for today</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Vehicle Status */}
          {assignedVan && (
            <Card className="saas-card">
              <CardHeader className="saas-card-header">
                <CardTitle className="saas-heading flex items-center">
                  <Truck className="h-5 w-5 text-primary mr-2" />
                  Your Vehicle
                </CardTitle>
              </CardHeader>
              <CardContent className="saas-card-content">
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-lg font-bold">{assignedVan.registration}</div>
                    <div className="text-sm text-muted-foreground">Registration</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold">{assignedVan.make}</div>
                    <div className="text-sm text-muted-foreground">Make</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold">{assignedVan.model}</div>
                    <div className="text-sm text-muted-foreground">Model</div>
                  </div>
                </div>
                <div className="mt-4">
                  <Button 
                    onClick={() => navigate('/driver/vehicle-check')}
                    variant="outline" 
                    size="sm"
                    className="w-full"
                  >
                    Vehicle Check
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Info & Quick Actions */}
        <div className="space-y-6">
          
          {/* Earnings Summary */}
          <Card className="saas-card">
            <CardHeader className="saas-card-header">
              <CardTitle className="saas-heading flex items-center">
                <DollarSign className="h-5 w-5 text-primary mr-2" />
                Earnings
              </CardTitle>
            </CardHeader>
            <CardContent className="saas-card-content">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Today</span>
                  <span className="font-bold text-lg">
                    £{todayEarnings?.total_earnings || '0.00'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">This Week</span>
                  <span className="font-bold text-lg">£{weeklyEarnings.toFixed(2)}</span>
                </div>
                <div className="pt-2">
                  <Button 
                    onClick={() => navigate('/driver/earnings-tracker')}
                    variant="outline" 
                    size="sm"
                    className="w-full"
                  >
                    <TrendingUp className="h-4 w-4 mr-2" />
                    View Details
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="saas-card">
            <CardHeader className="saas-card-header">
              <CardTitle className="saas-heading">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="saas-card-content">
              <div className="space-y-3">
                <Button 
                  onClick={() => navigate('/driver/incident-report')}
                  variant="outline" 
                  size="sm"
                  className="w-full justify-start"
                >
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Report Incident
                </Button>
                <Button 
                  onClick={() => navigate('/driver/route-feedback')}
                  variant="outline" 
                  size="sm"
                  className="w-full justify-start"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Route Feedback
                </Button>
                <Button 
                  onClick={() => navigate('/driver/news-chat')}
                  variant="outline" 
                  size="sm"
                  className="w-full justify-start"
                >
                  <Bell className="h-4 w-4 mr-2" />
                  News & Chat
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Announcements */}
          {announcements && announcements.length > 0 && (
            <Card className="saas-card">
              <CardHeader className="saas-card-header">
                <CardTitle className="saas-heading flex items-center">
                  <Bell className="h-5 w-5 text-primary mr-2" />
                  Announcements
                </CardTitle>
              </CardHeader>
              <CardContent className="saas-card-content">
                <div className="space-y-3">
                  {announcements.slice(0, 2).map((announcement: any) => (
                    <div key={announcement.id} className="p-3 bg-muted/50 rounded-lg">
                      <div className="font-medium text-sm">{announcement.title}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {format(new Date(announcement.created_at), 'MMM dd')}
                      </div>
                    </div>
                  ))}
                  {announcements.length > 2 && (
                    <Button 
                      onClick={() => navigate('/driver/news-chat')}
                      variant="outline" 
                      size="sm"
                      className="w-full"
                    >
                      View All
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default DriverDashboard;