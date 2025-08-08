import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { DollarSign, TrendingUp, Target, Clock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfToday, startOfWeek, startOfMonth } from 'date-fns';

const EarningsTracker = () => {
  const { profile } = useAuth();

  // Fetch driver profile to get their ID
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

  // Fetch earnings data
  const { data: earnings } = useQuery({
    queryKey: ['driver-earnings', driverProfile?.id],
    queryFn: async () => {
      if (!driverProfile?.id) return null;

      const today = startOfToday();
      const weekStart = startOfWeek(today, { weekStartsOn: 1 });
      const monthStart = startOfMonth(today);

      // Get today's earnings
      const { data: todayData } = await supabase
        .from('driver_earnings')
        .select('*')
        .eq('driver_id', driverProfile.id)
        .gte('earning_date', format(today, 'yyyy-MM-dd'));

      // Get this week's earnings
      const { data: weekData } = await supabase
        .from('driver_earnings')
        .select('*')
        .eq('driver_id', driverProfile.id)
        .gte('earning_date', format(weekStart, 'yyyy-MM-dd'));

      // Get this month's earnings
      const { data: monthData } = await supabase
        .from('driver_earnings')
        .select('*')
        .eq('driver_id', driverProfile.id)
        .gte('earning_date', format(monthStart, 'yyyy-MM-dd'));

      const calculateTotals = (data: any[]) => {
        if (!data) return { total: 0, base: 0, parcel: 0, bonus: 0, overtime: 0, adjustments: 0 };
        
        return data.reduce((acc, item) => ({
          total: acc.total + Number(item.total_earnings || 0),
          base: acc.base + Number(item.base_pay || 0),
          parcel: acc.parcel + Number(item.parcel_pay || 0),
          bonus: acc.bonus + Number(item.bonus_pay || 0),
          overtime: acc.overtime + Number(item.overtime_pay || 0),
          adjustments: acc.adjustments + Number(item.adjustments || 0)
        }), { total: 0, base: 0, parcel: 0, bonus: 0, overtime: 0, adjustments: 0 });
      };

      return {
        today: calculateTotals(todayData),
        week: calculateTotals(weekData),
        month: calculateTotals(monthData)
      };
    },
    enabled: !!driverProfile?.id
  });

  const EarningsCard = ({ 
    title, 
    icon: Icon, 
    earnings, 
    target = 1000, 
    period 
  }: { 
    title: string; 
    icon: any; 
    earnings: any; 
    target?: number; 
    period: string;
  }) => {
    const progress = earnings ? (earnings.total / target) * 100 : 0;
    
    return (
      <Card className="relative overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold animate-fade-in">
            £{earnings?.total.toFixed(2) || '0.00'}
          </div>
          <Progress value={Math.min(progress, 100)} className="mt-2" />
          <div className="flex justify-between text-xs text-muted-foreground mt-2">
            <span>{Math.round(progress)}% of target</span>
            <span>£{target}</span>
          </div>
          
          {earnings && (
            <div className="mt-4 space-y-1">
              <div className="flex justify-between text-xs">
                <span>Base Pay:</span>
                <span>£{earnings.base.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span>Parcel Pay:</span>
                <span>£{earnings.parcel.toFixed(2)}</span>
              </div>
              {earnings.bonus > 0 && (
                <div className="flex justify-between text-xs text-green-600">
                  <span>Bonuses:</span>
                  <span>£{earnings.bonus.toFixed(2)}</span>
                </div>
              )}
              {earnings.overtime > 0 && (
                <div className="flex justify-between text-xs text-blue-600">
                  <span>Overtime:</span>
                  <span>£{earnings.overtime.toFixed(2)}</span>
                </div>
              )}
              {earnings.adjustments !== 0 && (
                <div className={`flex justify-between text-xs ${earnings.adjustments > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  <span>Adjustments:</span>
                  <span>£{earnings.adjustments.toFixed(2)}</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Live Earnings Tracker</h1>
        <p className="text-muted-foreground">Track your earnings and progress towards your targets</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <EarningsCard
          title="Today's Earnings"
          icon={DollarSign}
          earnings={earnings?.today}
          target={150}
          period="today"
        />
        
        <EarningsCard
          title="This Week"
          icon={TrendingUp}
          earnings={earnings?.week}
          target={750}
          period="week"
        />
        
        <EarningsCard
          title="This Month"
          icon={Target}
          earnings={earnings?.month}
          target={3000}
          period="month"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Activity
          </CardTitle>
          <CardDescription>
            Your earnings are updated automatically after each End of Day submission
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Complete your End of Day report to see today's earnings update here</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EarningsTracker;