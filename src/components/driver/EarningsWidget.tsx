import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { DollarSign, TrendingUp, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfToday, startOfWeek } from 'date-fns';
import { useNavigate } from 'react-router-dom';

const EarningsWidget = () => {
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

  // Fetch today's and week's earnings
  const { data: earnings } = useQuery({
    queryKey: ['driver-earnings-widget', driverProfile?.id],
    queryFn: async () => {
      if (!driverProfile?.id) return null;

      const today = startOfToday();
      const weekStart = startOfWeek(today, { weekStartsOn: 1 });

      const [todayResult, weekResult] = await Promise.all([
        supabase
          .from('driver_earnings')
          .select('*')
          .eq('driver_id', driverProfile.id)
          .gte('earning_date', format(today, 'yyyy-MM-dd')),
        supabase
          .from('driver_earnings')
          .select('*')
          .eq('driver_id', driverProfile.id)
          .gte('earning_date', format(weekStart, 'yyyy-MM-dd'))
      ]);

      const todayTotal = todayResult.data?.reduce((sum, earning) => 
        sum + (earning.base_pay || 0) + (earning.parcel_pay || 0) + (earning.bonus_pay || 0) + (earning.overtime_pay || 0) + (earning.adjustments || 0), 0) || 0;
      
      const weekTotal = weekResult.data?.reduce((sum, earning) => 
        sum + (earning.base_pay || 0) + (earning.parcel_pay || 0) + (earning.bonus_pay || 0) + (earning.overtime_pay || 0) + (earning.adjustments || 0), 0) || 0;

      return { todayTotal, weekTotal };
    },
    enabled: !!driverProfile?.id
  });

  const weeklyTarget = 500; // Example weekly target
  const weekProgress = earnings?.weekTotal ? (earnings.weekTotal / weeklyTarget) * 100 : 0;

  return (
    <Card className="logistics-card bg-gradient-subtle">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <DollarSign className="h-5 w-5 text-success" />
            <CardTitle className="text-lg">Earnings</CardTitle>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/driver/earnings')}>
            <Eye className="h-4 w-4" />
          </Button>
        </div>
        <CardDescription>Your earnings overview</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-success">
              £{earnings?.todayTotal?.toFixed(2) || '0.00'}
            </div>
            <div className="text-sm text-muted-foreground">Today</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gradient">
              £{earnings?.weekTotal?.toFixed(2) || '0.00'}
            </div>
            <div className="text-sm text-muted-foreground">This Week</div>
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Weekly Target</span>
            <span>£{weeklyTarget}</span>
          </div>
          <Progress value={Math.min(weekProgress, 100)} className="h-2" />
          <div className="text-xs text-muted-foreground text-center">
            {weekProgress.toFixed(0)}% of weekly target
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default EarningsWidget;