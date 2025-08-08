import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trophy, Medal, Award, Eye, Star } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

const LeaderboardWidget = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();

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

  // Fetch recent achievements
  const { data: achievements } = useQuery({
    queryKey: ['driver-achievements-widget', driverProfile?.id],
    queryFn: async () => {
      if (!driverProfile?.id) return [];
      
      const { data, error } = await supabase
        .from('driver_achievements')
        .select('*')
        .eq('driver_id', driverProfile.id)
        .order('earned_at', { ascending: false })
        .limit(3);

      if (error) throw error;
      return data;
    },
    enabled: !!driverProfile?.id
  });

  // Mock current position (would be calculated from actual data)
  const currentPosition = 3;
  const totalDrivers = 45;

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return <Trophy className="h-4 w-4 text-yellow-500" />;
      case 2: return <Medal className="h-4 w-4 text-gray-400" />;
      case 3: return <Award className="h-4 w-4 text-amber-600" />;
      default: return <span className="text-sm font-bold">#{rank}</span>;
    }
  };

  return (
    <Card className="logistics-card bg-gradient-subtle">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Trophy className="h-5 w-5 text-warning" />
            <CardTitle className="text-lg">Leaderboard</CardTitle>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/driver/leaderboard')}>
            <Eye className="h-4 w-4" />
          </Button>
        </div>
        <CardDescription>Your ranking & achievements</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center space-x-2">
            {getRankIcon(currentPosition)}
            <span className="text-lg font-semibold">
              #{currentPosition} of {totalDrivers}
            </span>
          </div>
          <div className="text-sm text-muted-foreground">
            Monthly ranking
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Recent Achievements</span>
            <Badge variant="secondary" className="text-xs">
              {achievements?.length || 0} total
            </Badge>
          </div>
          
          {achievements && achievements.length > 0 ? (
            <div className="space-y-2">
              {achievements.slice(0, 2).map((achievement, index) => (
                <div key={achievement.id} className="flex items-center space-x-2 p-2 rounded-lg bg-card/50">
                  <Star className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm">{achievement.achievement_type}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-sm text-muted-foreground py-2">
              Complete your first delivery to earn achievements!
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default LeaderboardWidget;