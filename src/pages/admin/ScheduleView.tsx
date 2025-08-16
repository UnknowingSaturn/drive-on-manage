import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, ChevronLeft, ChevronRight, User, MapPin, Save, AlertCircle, Edit, Trash2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfWeek, addDays, addWeeks, subWeeks } from 'date-fns';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
const ScheduleView = () => {
  const {
    profile
  } = useAuth();
  const {
    toast
  } = useToast();
  const queryClient = useQueryClient();
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const weekStart = startOfWeek(currentWeek, {
    weekStartsOn: 1
  }); // Monday start
  const weekDays = Array.from({
    length: 7
  }, (_, i) => addDays(weekStart, i));

  // Fetch rounds for the company
  const {
    data: rounds
  } = useQuery({
    queryKey: ['rounds', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      const {
        data,
        error
      } = await supabase.from('rounds').select('*').eq('company_id', profile.company_id).eq('is_active', true).order('round_number');
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.company_id
  });

  // Fetch drivers for the company - use the same working pattern as driver management
  const {
    data: drivers,
    isLoading: driversLoading,
    error: driversError
  } = useQuery({
    queryKey: ['schedule-drivers', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      console.log('Fetching drivers for schedule, company_id:', profile.company_id);

      // Use the same query pattern as the working driver management page
      const {
        data,
        error
      } = await supabase.rpc('get_drivers_with_profiles', {
        company_ids: [profile.company_id]
      });
      if (error) {
        console.error('Error fetching drivers for schedule:', error);
        throw error;
      }
      console.log('Schedule drivers query result:', data);

      // Filter for active drivers and format for schedule use
      return data?.filter((driver: any) => driver.is_active && driver.status === 'active').map((driver: any) => ({
        ...driver,
        profiles: {
          first_name: driver.first_name,
          last_name: driver.last_name
        }
      })) || [];
    },
    enabled: !!profile?.company_id
  });

  // Fetch schedule assignments for the current week
  const {
    data: scheduleAssignments,
    isLoading: scheduleLoading
  } = useQuery({
    queryKey: ['schedules', profile?.company_id, weekStart.toISOString()],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      const weekEnd = addDays(weekStart, 6);
      const {
        data,
        error
      } = await supabase.from('schedules').select(`
          *,
          driver:driver_profiles(
            id,
            parcel_rate,
            parcel_rate,
            profiles:profiles(first_name, last_name)
          ),
          round:rounds(round_number, description, base_rate)
        `).eq('company_id', profile.company_id).gte('scheduled_date', format(weekStart, 'yyyy-MM-dd')).lte('scheduled_date', format(weekEnd, 'yyyy-MM-dd')).eq('status', 'scheduled');
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.company_id,
    refetchInterval: 30000
  });

  // Convert schedule data to grid format
  const schedule = React.useMemo(() => {
    const scheduleGrid: {
      [roundId: string]: {
        [dayKey: string]: any;
      };
    } = {};
    scheduleAssignments?.forEach(assignment => {
      const dayKey = format(new Date(assignment.scheduled_date), 'EEE');
      const roundId = assignment.round_id;
      if (!scheduleGrid[roundId]) {
        scheduleGrid[roundId] = {};
      }
      scheduleGrid[roundId][dayKey] = {
        id: assignment.id,
        driver_id: assignment.driver_id,
        driver_rate: assignment.driver_rate,
        driver: assignment.driver
      };
    });
    return scheduleGrid;
  }, [scheduleAssignments]);

  // Save schedule mutation
  const saveScheduleMutation = useMutation({
    mutationFn: async ({
      roundId,
      dayKey,
      driverId,
      remove = false
    }: {
      roundId: string;
      dayKey: string;
      driverId?: string;
      remove?: boolean;
    }) => {
      const scheduledDate = format(weekDays.find(day => format(day, 'EEE') === dayKey)!, 'yyyy-MM-dd');
      const existingAssignment = schedule[roundId]?.[dayKey];
      if (remove || !driverId) {
        // Remove assignment
        if (existingAssignment?.id) {
          const {
            error
          } = await supabase.from('schedules').delete().eq('id', existingAssignment.id);
          if (error) throw error;
        }
        return;
      }

      // Get driver rate
      const driver = drivers?.find(d => d.id === driverId);
      const round = rounds?.find(r => r.id === roundId);
      const driverRate = driver?.parcel_rate || round?.parcel_rate || 0;
      if (existingAssignment?.id) {
        // Update existing assignment
        const {
          error
        } = await supabase.from('schedules').update({
          driver_id: driverId,
          driver_rate: driverRate,
          updated_at: new Date().toISOString()
        }).eq('id', existingAssignment.id);
        if (error) throw error;
      } else {
        // Create new assignment
        const {
          error
        } = await supabase.from('schedules').insert({
          company_id: profile!.company_id!,
          round_id: roundId,
          driver_id: driverId,
          scheduled_date: scheduledDate,
          week_start_date: format(weekStart, 'yyyy-MM-dd'),
          driver_rate: driverRate,
          created_by: profile!.user_id,
          status: 'scheduled'
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      setHasUnsavedChanges(false);
      toast({
        title: "Schedule updated",
        description: "Driver assignment has been saved successfully."
      });
      queryClient.invalidateQueries({
        queryKey: ['schedules']
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error saving schedule",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  const getDriverName = (assignment: any) => {
    if (!assignment?.driver) return null;
    const profile = assignment.driver.profiles;
    return profile ? `${profile.first_name} ${profile.last_name}` : null;
  };
  const getAssignmentStatus = (roundId: string, dayKey: string) => {
    return schedule[roundId]?.[dayKey] ? 'covered' : 'uncovered';
  };
  const getCellBackgroundColor = (roundId: string, dayKey: string) => {
    const status = getAssignmentStatus(roundId, dayKey);
    return status === 'covered' ? 'bg-green-50 hover:bg-green-100 border-green-200' : 'bg-red-50 hover:bg-red-100 border-red-200';
  };
  const handleAssignment = (roundId: string, dayKey: string, driverId: string | null) => {
    setHasUnsavedChanges(true);
    if (driverId === '__unassigned__' || !driverId) {
      saveScheduleMutation.mutate({
        roundId,
        dayKey,
        remove: true
      });
    } else {
      saveScheduleMutation.mutate({
        roundId,
        dayKey,
        driverId
      });
    }
  };
  const navigateWeek = (direction: 'prev' | 'next') => {
    setCurrentWeek(prev => direction === 'prev' ? subWeeks(prev, 1) : addWeeks(prev, 1));
  };

  // Delete round mutation
  const deleteRoundMutation = useMutation({
    mutationFn: async (roundId: string) => {
      const { error } = await supabase
        .from('rounds')
        .update({ is_active: false })
        .eq('id', roundId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Round deleted",
        description: "Round has been deactivated successfully."
      });
      queryClient.invalidateQueries({ queryKey: ['rounds'] });
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error deleting round",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  return <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        
        <SidebarInset className="flex-1">
          <header className="border-b bg-card sticky top-0 z-10">
            <div className="flex items-center px-4 py-4">
              <SidebarTrigger className="mr-4" />
              <div>
                <h1 className="text-xl font-semibold text-foreground">Schedule View</h1>
                <p className="text-sm text-muted-foreground">Manage weekly round assignments</p>
              </div>
            </div>
          </header>

          <main className="p-6 space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold">Weekly Planning</h2>
                <p className="text-muted-foreground">Driver assignment schedule</p>
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

      {hasUnsavedChanges && <Alert className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You have unsaved changes. They will be saved automatically when you make assignments.
          </AlertDescription>
        </Alert>}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
            <CardTitle className="text-sm font-medium">This Week Coverage</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {(() => {
                    const totalSlots = (rounds?.length || 0) * 7;
                    const coveredSlots = Object.values(schedule).reduce((acc, roundSchedule) => acc + Object.keys(roundSchedule).length, 0);
                    const coverage = totalSlots > 0 ? Math.round(coveredSlots / totalSlots * 100) : 0;
                    return `${coverage}%`;
                  })()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assignments</CardTitle>
            <Save className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Object.values(schedule).reduce((acc, roundSchedule) => acc + Object.keys(roundSchedule).length, 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Weekly Schedule</CardTitle>
          <CardDescription>
            Rounds listed on the left, days across the top. Click to assign drivers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {scheduleLoading ? <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mr-4"></div>
              <span>Loading rounds and assignments...</span>
            </div> : rounds?.length === 0 ? <div className="text-center py-8 text-muted-foreground">
              <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">No rounds available</h3>
              <p>Create rounds first to schedule driver assignments.</p>
            </div> : <div className="overflow-x-auto">
              <div className="min-w-[800px]">
                {/* Header Row */}
                <div className="grid grid-cols-8 gap-2 mb-4 p-2 bg-muted rounded-lg">
                  <div className="font-semibold text-sm text-muted-foreground">Round</div>
                  {weekDays.map((day, index) => <div key={index} className="text-center">
                      <div className="font-semibold text-sm">{format(day, 'EEE')}</div>
                      <div className="text-xs text-muted-foreground">{format(day, 'dd/MM')}</div>
                    </div>)}
                </div>

                {/* Data Rows */}
                <div className="space-y-2">
                  {rounds?.map(round => <div key={round.id} className="grid grid-cols-8 gap-2 p-2 border rounded-lg hover:bg-muted/50">
                      {/* Round Info Column */}
                      <div className="flex flex-col justify-center">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold text-sm">Round {round.round_number}</div>
                            <div className="text-xs text-muted-foreground truncate" title={round.description}>
                              {round.description || 'No description'}
                            </div>
                            {round.base_rate && <Badge variant="outline" className="text-xs w-fit mt-1">
                                £{round.base_rate}/day
                              </Badge>}
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => {
                                // Navigate to round edit - you can implement this
                                toast({
                                  title: "Edit functionality",
                                  description: "Round editing can be implemented here"
                                });
                              }}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                              onClick={() => deleteRoundMutation.mutate(round.id)}
                              disabled={deleteRoundMutation.isPending}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Day Assignment Columns */}
                      {weekDays.map((day, dayIndex) => {
                        const dayKey = format(day, 'EEE');
                        const assignment = schedule[round.id]?.[dayKey];
                        const status = getAssignmentStatus(round.id, dayKey);
                        const cellBgColor = getCellBackgroundColor(round.id, dayKey);
                        return <div key={dayIndex} className={`p-2 rounded border ${cellBgColor} min-h-[60px]`}>
                            <Select value={assignment?.driver_id || '__unassigned__'} onValueChange={value => handleAssignment(round.id, dayKey, value === '__unassigned__' ? null : value)} disabled={saveScheduleMutation.isPending}>
                              <SelectTrigger className="w-full text-xs h-auto p-1">
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__unassigned__" className="text-muted-foreground">
                                  Unassigned
                                </SelectItem>
                                {drivers?.map(driver => <SelectItem key={driver.id} value={driver.id}>
                                    <div className="flex flex-col items-start">
                                      <span className="font-medium text-xs">
                                        {driver.profiles?.first_name} {driver.profiles?.last_name}
                                      </span>
                                      {driver.parcel_rate && <span className="text-xs text-muted-foreground">
                                          £{driver.parcel_rate}/parcel
                                        </span>}
                                    </div>
                                  </SelectItem>)}
                              </SelectContent>
                            </Select>
                            
                            {assignment && <div className="mt-1 text-center">
                                <div className="text-xs font-medium truncate" title={getDriverName(assignment)}>
                                  {getDriverName(assignment)}
                                </div>
                              </div>}
                          </div>;
                      })}
                    </div>)}
                </div>
              </div>
            </div>}
        </CardContent>
      </Card>

          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>;
};
export default ScheduleView;