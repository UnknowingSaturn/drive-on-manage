import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Trophy, Medal, Award, Star, Target, Truck, Clock, Shield } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const Leaderboard = () => {
  const { profile } = useAuth();

  // Fetch driver profile
  const { data: driverProfile } = useQuery({
    queryKey: ['driver-profile', profile?.user_id],
    queryFn: async () => {
      if (!profile?.user_id) return null;
      
      const { data, error } = await supabase
        .from('driver_profiles')
        .select('*')
        .eq('user_id', profile.user_id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!profile?.user_id
  });

  // Fetch achievements
  const { data: achievements } = useQuery({
    queryKey: ['driver-achievements', driverProfile?.id],
    queryFn: async () => {
      if (!driverProfile?.id) return [];
      
      const { data, error } = await supabase
        .from('driver_achievements')
        .select('*')
        .eq('driver_id', driverProfile.id)
        .order('earned_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!driverProfile?.id
  });

  // Mock leaderboard data (in real app, this would come from aggregated driver data)
  const leaderboardData = [
    { rank: 1, name: 'John Smith', parcels: 847, accuracy: 98.5, earnings: 3240 },
    { rank: 2, name: 'Sarah Johnson', parcels: 823, accuracy: 97.8, earnings: 3180 },
    { rank: 3, name: 'Mike Brown', parcels: 798, accuracy: 96.9, earnings: 3050 },
    { rank: 4, name: 'You', parcels: 756, accuracy: 95.2, earnings: 2890 },
    { rank: 5, name: 'Lisa Wilson', parcels: 742, accuracy: 94.8, earnings: 2850 },
  ];

  const availableBadges = [
    {
      id: 'zero_incidents',
      name: 'Zero Incidents Month',
      description: 'Complete a month without any incidents',
      icon: Shield,
      progress: 28,
      target: 30,
      completed: false
    },
    {
      id: 'completion_week',
      name: '100% Completion Week',
      description: 'Complete all deliveries for a full week',
      icon: Target,
      progress: 5,
      target: 7,
      completed: false
    },
    {
      id: 'fuel_saver',
      name: 'Fuel Saver',
      description: 'Achieve excellent fuel efficiency ratings',
      icon: Truck,
      progress: 8,
      target: 10,
      completed: false
    },
    {
      id: 'early_bird',
      name: 'Early Bird',
      description: 'Start routes early consistently',
      icon: Clock,
      progress: 10,
      target: 10,
      completed: true
    }
  ];

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="h-5 w-5 text-yellow-500" />;
      case 2:
        return <Medal className="h-5 w-5 text-gray-400" />;
      case 3:
        return <Medal className="h-5 w-5 text-amber-600" />;
      default:
        return <div className="h-5 w-5 flex items-center justify-center text-sm font-bold">{rank}</div>;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Driver Leaderboard</h1>
        <p className="text-muted-foreground">See how you stack up against other drivers</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Leaderboard */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Monthly Rankings
            </CardTitle>
            <CardDescription>Based on parcels delivered, accuracy, and earnings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {leaderboardData.map((driver) => (
                <div
                  key={driver.rank}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    driver.name === 'You' ? 'bg-primary/5 border-primary' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {getRankIcon(driver.rank)}
                    <div>
                      <div className={`font-medium ${driver.name === 'You' ? 'text-primary' : ''}`}>
                        {driver.name}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {driver.parcels} parcels • {driver.accuracy}% accuracy
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">£{driver.earnings}</div>
                    <div className="text-sm text-muted-foreground">this month</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Achievements */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              Achievements & Badges
            </CardTitle>
            <CardDescription>Track your progress and earn rewards</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {availableBadges.map((badge) => {
                const IconComponent = badge.icon;
                const progressPercentage = (badge.progress / badge.target) * 100;
                
                return (
                  <div key={badge.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <IconComponent className={`h-5 w-5 ${badge.completed ? 'text-yellow-500' : 'text-muted-foreground'}`} />
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {badge.name}
                            {badge.completed && (
                              <Badge variant="secondary" className="text-xs">
                                <Star className="h-3 w-3 mr-1" />
                                Earned
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">{badge.description}</div>
                        </div>
                      </div>
                    </div>
                    {!badge.completed && (
                      <div className="space-y-1">
                        <Progress value={progressPercentage} />
                        <div className="text-xs text-muted-foreground text-right">
                          {badge.progress}/{badge.target}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Achievements */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5" />
            Recent Achievements
          </CardTitle>
          <CardDescription>Your latest earned badges and milestones</CardDescription>
        </CardHeader>
        <CardContent>
          {achievements?.length ? (
            <div className="space-y-4">
              {achievements.slice(0, 5).map((achievement: any) => (
                <div key={achievement.id} className="flex items-center gap-3 p-3 border rounded-lg">
                  <Award className="h-8 w-8 text-yellow-500" />
                  <div className="flex-1">
                    <div className="font-medium">{achievement.achievement_name}</div>
                    <div className="text-sm text-muted-foreground">{achievement.description}</div>
                    <div className="text-xs text-muted-foreground">
                      Earned on {new Date(achievement.earned_at).toLocaleDateString()}
                    </div>
                  </div>
                  {achievement.is_completed && (
                    <Badge variant="secondary">
                      <Star className="h-3 w-3 mr-1" />
                      Completed
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Award className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No achievements earned yet</p>
              <p className="text-sm">Complete deliveries and maintain high performance to earn badges!</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Leaderboard;