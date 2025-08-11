import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Clock, Route, DollarSign, Calendar, CheckCircle2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

const TodaySchedule = () => {
  const { user, profile } = useAuth();
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

  // Get today's assigned rounds with real-time updates
  const { data: todayRounds, refetch } = useQuery({
    queryKey: ['today-schedule', driverProfile?.id, today],
    queryFn: async () => {
      if (!driverProfile?.id) return [];
      
      const { data, error } = await supabase
        .from('schedules')
        .select(`
          *,
          round:rounds(
            id,
            round_number,
            description,
            rate,
            road_lists
          )
        `)
        .eq('driver_id', driverProfile.id)
        .eq('scheduled_date', today)
        .eq('status', 'scheduled')
        .order('created_at');

      if (error) throw error;
      return data || [];
    },
    enabled: !!driverProfile?.id,
    refetchInterval: 30000 // Poll every 30 seconds for updates
  });

  // Set up real-time subscription
  useEffect(() => {
    if (!driverProfile?.id) return;

    const channel = supabase
      .channel('driver-schedule-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'schedules',
          filter: `driver_id=eq.${driverProfile.id}`
        },
        () => {
          console.log('Schedule updated, refetching...');
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [driverProfile?.id, refetch]);

  const getTotalEstimatedPay = () => {
    if (!todayRounds || !driverProfile) return 0;
    
    return todayRounds.reduce((total, schedule) => {
      const rate = schedule.round?.rate || driverProfile.parcel_rate || 0;
      return total + rate;
    }, 0);
  };

  if (!driverProfile) {
    return (
      <Card className="logistics-card">
        <CardContent className="p-6 text-center">
          <div className="text-muted-foreground">Loading your schedule...</div>
        </CardContent>
      </Card>
    );
  }

  if (!todayRounds || todayRounds.length === 0) {
    return (
      <Card className="logistics-card">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Calendar className="h-5 w-5 text-primary mr-2" />
            Today's Schedule
          </CardTitle>
          <CardDescription>
            {format(new Date(), 'EEEE, MMMM do, yyyy')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground mb-2">
              No routes assigned today
            </h3>
            <p className="text-sm text-muted-foreground">
              Check back later or contact your dispatcher for your daily assignments.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="logistics-card">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            <Calendar className="h-5 w-5 text-primary mr-2" />
            Today's Schedule
          </div>
          <Badge variant="secondary" className="text-xs">
            {todayRounds.length} {todayRounds.length === 1 ? 'Round' : 'Rounds'}
          </Badge>
        </CardTitle>
        <CardDescription>
          {format(new Date(), 'EEEE, MMMM do, yyyy')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Summary Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="text-center p-4 rounded-lg bg-card/50">
              <div className="text-xl font-bold text-primary">
                {todayRounds.length}
              </div>
              <div className="text-sm text-muted-foreground">Assigned Rounds</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-card/50">
              <div className="text-xl font-bold text-success">
                £{getTotalEstimatedPay().toFixed(2)}
              </div>
              <div className="text-sm text-muted-foreground">Base Pay (Rounds)</div>
            </div>
          </div>

          {/* Round Details */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
              Your Rounds
            </h4>
            {todayRounds.map((schedule, index) => (
              <div key={schedule.id} className="border rounded-lg p-4 bg-card/30 hover:bg-card/50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <Route className="h-4 w-4 text-primary" />
                      <span className="font-semibold">
                        {schedule.round?.round_number}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        Round {index + 1}
                      </Badge>
                    </div>
                    
                    {schedule.round?.description && (
                      <p className="text-sm text-muted-foreground mb-2">
                        {schedule.round.description}
                      </p>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                        <div className="flex items-center">
                          <DollarSign className="h-3 w-3 mr-1" />
                          <span>£{schedule.driver_rate || 0}/parcel</span>
                        </div>
                        <div className="flex items-center">
                          <Clock className="h-3 w-3 mr-1" />
                          <span>Scheduled</span>
                        </div>
                      </div>
                    </div>

                    {/* Road Lists */}
                    {schedule.round?.road_lists && schedule.round.road_lists.length > 0 && (
                      <div className="mt-3">
                        <div className="text-xs font-medium text-muted-foreground mb-1">
                          Route Roads:
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {schedule.round.road_lists.slice(0, 3).map((road: string, idx: number) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {road}
                            </Badge>
                          ))}
                          {schedule.round.road_lists.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{schedule.round.road_lists.length - 3} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Status Footer */}
          <div className="flex items-center justify-between pt-3 border-t">
            <div className="flex items-center text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-success mr-2" />
              Schedule updated automatically
            </div>
            <div className="text-xs text-muted-foreground">
              Last updated: {format(new Date(), 'HH:mm')}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default TodaySchedule;