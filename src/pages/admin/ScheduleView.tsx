import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, ChevronLeft, ChevronRight, User, MapPin } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfWeek, addDays, addWeeks, subWeeks } from 'date-fns';

const ScheduleView = () => {
  const { profile } = useAuth();
  const [currentWeek, setCurrentWeek] = useState(new Date());
  
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 }); // Monday start
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Fetch rounds for the company
  const { data: rounds } = useQuery({
    queryKey: ['rounds', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      
      const { data, error } = await supabase
        .from('rounds')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('is_active', true)
        .order('round_number');

      if (error) throw error;
      return data;
    },
    enabled: !!profile?.company_id
  });

  // Fetch drivers for the company
  const { data: drivers } = useQuery({
    queryKey: ['drivers', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      
      const { data: drivers, error: driversError } = await supabase
        .from('driver_profiles')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('status', 'active');

      if (driversError) throw driversError;

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name')
        .in('user_id', drivers?.map(d => d.user_id) || []);

      if (profilesError) throw profilesError;

      return drivers?.map(driver => ({
        ...driver,
        profiles: profiles?.find(p => p.user_id === driver.user_id)
      })) || [];
    },
    enabled: !!profile?.company_id
  });

  // Mock schedule data - in real app this would come from database
  const [schedule, setSchedule] = useState<{[key: string]: {[key: string]: string | null}}>({
    // round_id: { 'Mon': driver_id, 'Tue': driver_id, etc }
  });

  const getDriverName = (driverId: string | null) => {
    if (!driverId) return null;
    const driver = drivers?.find(d => d.id === driverId);
    return driver ? `${driver.profiles?.first_name} ${driver.profiles?.last_name}` : null;
  };

  const getAssignmentStatus = (roundId: string, dayKey: string) => {
    const assignment = schedule[roundId]?.[dayKey];
    return assignment ? 'covered' : 'uncovered';
  };

  const handleAssignment = (roundId: string, dayKey: string, driverId: string | null) => {
    setSchedule(prev => ({
      ...prev,
      [roundId]: {
        ...prev[roundId],
        [dayKey]: driverId
      }
    }));
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    setCurrentWeek(prev => 
      direction === 'prev' ? subWeeks(prev, 1) : addWeeks(prev, 1)
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Schedule View</h1>
          <p className="text-muted-foreground">Manage weekly round assignments</p>
        </div>
        
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={() => navigateWeek('prev')}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-lg font-semibold min-w-[200px] text-center">
            Week of {format(weekStart, 'MMM dd, yyyy')}
          </div>
          <Button variant="outline" onClick={() => navigateWeek('next')}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Rounds</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rounds?.length || 0}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Drivers</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{drivers?.length || 0}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Coverage Rate</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">85%</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Weekly Schedule</CardTitle>
          <CardDescription>
            Assign drivers to rounds for each day of the week
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="text-left p-3 border-b font-medium min-w-[120px]">Round</th>
                  {weekDays.map((day, index) => (
                    <th key={index} className="text-center p-3 border-b font-medium min-w-[150px]">
                      <div className="text-sm text-muted-foreground">
                        {format(day, 'EEE')}
                      </div>
                      <div className="text-base">
                        {format(day, 'dd/MM')}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rounds?.map((round) => (
                  <tr key={round.id} className="hover:bg-muted/50">
                    <td className="p-3 border-b">
                      <div className="font-medium">{round.round_number}</div>
                      <div className="text-sm text-muted-foreground truncate max-w-[100px]">
                        {round.description}
                      </div>
                      {round.base_rate && (
                        <div className="text-xs text-muted-foreground">
                          £{round.base_rate}/day
                        </div>
                      )}
                    </td>
                    {weekDays.map((day, dayIndex) => {
                      const dayKey = format(day, 'EEE');
                      const status = getAssignmentStatus(round.id, dayKey);
                      const assignedDriver = getDriverName(schedule[round.id]?.[dayKey]);
                      
                      return (
                        <td key={dayIndex} className="p-3 border-b text-center">
                          <div className="space-y-2">
                            <Select
                              value={schedule[round.id]?.[dayKey] || ''}
                              onValueChange={(value) => 
                                handleAssignment(round.id, dayKey, value || null)
                              }
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Assign driver" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="">Unassigned</SelectItem>
                                {drivers?.map((driver) => (
                                  <SelectItem key={driver.id} value={driver.id}>
                                    {driver.profiles?.first_name} {driver.profiles?.last_name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            
                            <Badge 
                              variant={status === 'covered' ? 'default' : 'destructive'}
                              className="text-xs"
                            >
                              {status === 'covered' ? 'Covered' : 'Uncovered'}
                            </Badge>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {rounds?.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No rounds available. Create rounds first to schedule assignments.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Schedule Legend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center space-x-2">
              <Badge variant="default">Covered</Badge>
              <span className="text-sm text-muted-foreground">Round has assigned driver</span>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="destructive">Uncovered</Badge>
              <span className="text-sm text-muted-foreground">Round needs driver assignment</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ScheduleView;