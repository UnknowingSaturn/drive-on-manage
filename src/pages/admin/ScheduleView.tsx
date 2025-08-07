import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, ChevronLeft, ChevronRight, User, MapPin, Save, AlertCircle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfWeek, addDays, addWeeks, subWeeks } from 'date-fns';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';

const ScheduleView = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
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

  // Fetch schedule assignments for the current week
  const { data: scheduleAssignments, isLoading: scheduleLoading } = useQuery({
    queryKey: ['schedules', profile?.company_id, weekStart.toISOString()],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      
      const weekEnd = addDays(weekStart, 6);
      
      const { data, error } = await supabase
        .from('schedules')
        .select(`
          *,
          driver:driver_profiles(
            id,
            hourly_rate,
            parcel_rate,
            profiles:profiles(first_name, last_name)
          ),
          round:rounds(round_number, description, base_rate)
        `)
        .eq('company_id', profile.company_id)
        .gte('scheduled_date', format(weekStart, 'yyyy-MM-dd'))
        .lte('scheduled_date', format(weekEnd, 'yyyy-MM-dd'))
        .eq('status', 'scheduled');

      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.company_id,
    refetchInterval: 30000
  });

  // Convert schedule data to grid format
  const schedule = React.useMemo(() => {
    const scheduleGrid: {[roundId: string]: {[dayKey: string]: any}} = {};
    
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
    mutationFn: async ({ roundId, dayKey, driverId, remove = false }: {
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
          const { error } = await supabase
            .from('schedules')
            .delete()
            .eq('id', existingAssignment.id);
          
          if (error) throw error;
        }
        return;
      }

      // Get driver rate
      const driver = drivers?.find(d => d.id === driverId);
      const round = rounds?.find(r => r.id === roundId);
      const driverRate = driver?.hourly_rate || round?.base_rate || 0;

      if (existingAssignment?.id) {
        // Update existing assignment
        const { error } = await supabase
          .from('schedules')
          .update({
            driver_id: driverId,
            driver_rate: driverRate,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingAssignment.id);
        
        if (error) throw error;
      } else {
        // Create new assignment
        const { error } = await supabase
          .from('schedules')
          .insert({
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
        description: "Driver assignment has been saved successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error saving schedule",
        description: error.message,
        variant: "destructive",
      });
    },
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
    return status === 'covered' 
      ? 'bg-green-50 hover:bg-green-100 border-green-200' 
      : 'bg-red-50 hover:bg-red-100 border-red-200';
  };

  const handleAssignment = (roundId: string, dayKey: string, driverId: string | null) => {
    setHasUnsavedChanges(true);
    
    if (driverId === '__unassigned__' || !driverId) {
      saveScheduleMutation.mutate({ roundId, dayKey, remove: true });
    } else {
      saveScheduleMutation.mutate({ roundId, dayKey, driverId });
    }
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    setCurrentWeek(prev => 
      direction === 'prev' ? subWeeks(prev, 1) : addWeeks(prev, 1)
    );
  };

  return (
    <SidebarProvider>
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

      {hasUnsavedChanges && (
        <Alert className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You have unsaved changes. They will be saved automatically when you make assignments.
          </AlertDescription>
        </Alert>
      )}

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
                const coveredSlots = Object.values(schedule).reduce((acc, roundSchedule) => 
                  acc + Object.keys(roundSchedule).length, 0
                );
                const coverage = totalSlots > 0 ? Math.round((coveredSlots / totalSlots) * 100) : 0;
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
              {Object.values(schedule).reduce((acc, roundSchedule) => 
                acc + Object.keys(roundSchedule).length, 0
              )}
            </div>
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
          {scheduleLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mr-4"></div>
              <span>Loading schedule...</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-border">
                <thead>
                  <tr>
                    <th className="text-left p-3 border border-border font-medium min-w-[140px] bg-muted/50">
                      Round
                    </th>
                    {weekDays.map((day, index) => (
                      <th key={index} className="text-center p-3 border border-border font-medium min-w-[160px] bg-muted/50">
                        <div className="text-sm text-muted-foreground">
                          {format(day, 'EEEE')}
                        </div>
                        <div className="text-base font-semibold">
                          {format(day, 'dd/MM')}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rounds?.map((round) => (
                    <tr key={round.id} className="hover:bg-muted/30">
                      <td className="p-3 border border-border bg-muted/30">
                        <div className="font-medium text-sm">{round.round_number}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-[120px]">
                          {round.description}
                        </div>
                        {round.base_rate && (
                          <div className="text-xs text-green-600 font-medium mt-1">
                            £{round.base_rate}/day
                          </div>
                        )}
                      </td>
                      {weekDays.map((day, dayIndex) => {
                        const dayKey = format(day, 'EEE');
                        const assignment = schedule[round.id]?.[dayKey];
                        const status = getAssignmentStatus(round.id, dayKey);
                        const assignedDriver = getDriverName(assignment);
                        const cellBgColor = getCellBackgroundColor(round.id, dayKey);
                        
                        return (
                          <td key={dayIndex} className={`p-2 border border-border text-center ${cellBgColor}`}>
                            <div className="space-y-2">
                              <Select
                                value={assignment?.driver_id || '__unassigned__'}
                                onValueChange={(value) => 
                                  handleAssignment(round.id, dayKey, value === '__unassigned__' ? null : value)
                                }
                                disabled={saveScheduleMutation.isPending}
                              >
                                <SelectTrigger className="w-full text-xs bg-background/90 border-border/50">
                                  <SelectValue placeholder="Assign driver" />
                                </SelectTrigger>
                                <SelectContent className="bg-background border border-border shadow-lg z-50">
                                  <SelectItem value="__unassigned__" className="text-muted-foreground">
                                    Unassigned
                                  </SelectItem>
                                  {drivers?.map((driver) => (
                                    <SelectItem key={driver.id} value={driver.id} className="hover:bg-muted">
                                      <div className="flex flex-col items-start">
                                        <span className="font-medium">
                                          {driver.profiles?.first_name} {driver.profiles?.last_name}
                                        </span>
                                        {driver.hourly_rate && (
                                          <span className="text-xs text-muted-foreground">
                                            £{driver.hourly_rate}/hr
                                          </span>
                                        )}
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              
                              <div className="flex flex-col space-y-1">
                                <Badge 
                                  variant={status === 'covered' ? 'default' : 'destructive'}
                                  className="text-xs"
                                >
                                  {status === 'covered' ? 'Assigned' : 'Vacant'}
                                </Badge>
                                
                                {assignment?.driver_rate && (
                                  <div className="text-xs text-muted-foreground bg-background/50 rounded px-1 py-0.5">
                                    £{assignment.driver_rate}/day
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          {rounds?.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">No rounds available</h3>
              <p>Create rounds first to schedule driver assignments.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Schedule Legend & Tips</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-3">Cell Colors</h4>
              <div className="space-y-2">
                <div className="flex items-center space-x-3">
                  <div className="w-4 h-4 bg-green-100 border border-green-200 rounded"></div>
                  <span className="text-sm">Driver assigned</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-4 h-4 bg-red-100 border border-red-200 rounded"></div>
                  <span className="text-sm">No driver assigned</span>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="font-medium mb-3">Status Badges</h4>
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center space-x-2">
                  <Badge variant="default" className="text-xs">Assigned</Badge>
                  <span className="text-sm text-muted-foreground">Driver allocated</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant="destructive" className="text-xs">Vacant</Badge>
                  <span className="text-sm text-muted-foreground">Needs coverage</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-muted/50 rounded-lg">
            <h4 className="font-medium mb-2">💡 Tips</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Driver rates are automatically applied when assignments are made</li>
              <li>• Changes are saved immediately when you select a driver</li>
              <li>• Use the week navigation to plan future schedules</li>
              <li>• Monitor coverage percentage for optimal planning</li>
            </ul>
          </div>
        </CardContent>
      </Card>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default ScheduleView;