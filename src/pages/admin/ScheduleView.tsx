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

  // Fetch schedule assignments for the current week with real-time updates
  const { data: scheduleAssignments, isLoading: scheduleLoading, refetch } = useQuery({
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
            parcel_rate,
            profiles:profiles(first_name, last_name)
          ),
          round:rounds(round_number, description, rate)
        `)
        .eq('company_id', profile.company_id)
        .gte('scheduled_date', format(weekStart, 'yyyy-MM-dd'))
        .lte('scheduled_date', format(weekEnd, 'yyyy-MM-dd'))
        .eq('status', 'scheduled');

      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.company_id,
    refetchInterval: 10000 // More frequent updates for admins
  });

  // Set up real-time subscription for schedule changes
  React.useEffect(() => {
    if (!profile?.company_id) return;

    const channel = supabase
      .channel('admin-schedule-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'schedules',
          filter: `company_id=eq.${profile.company_id}`
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
  }, [profile?.company_id, refetch]);

  // Convert schedule data to support multiple assignments per driver per day
  const schedule = React.useMemo(() => {
    const scheduleGrid: {[driverId: string]: {[dayKey: string]: any[]}} = {};
    
    scheduleAssignments?.forEach(assignment => {
      const dayKey = format(new Date(assignment.scheduled_date), 'EEE');
      const driverId = assignment.driver_id;
      
      if (!scheduleGrid[driverId]) {
        scheduleGrid[driverId] = {};
      }
      
      if (!scheduleGrid[driverId][dayKey]) {
        scheduleGrid[driverId][dayKey] = [];
      }
      
      scheduleGrid[driverId][dayKey].push({
        id: assignment.id,
        round_id: assignment.round_id,
        driver_rate: assignment.driver_rate,
        driver: assignment.driver,
        round: assignment.round
      });
    });
    
    return scheduleGrid;
  }, [scheduleAssignments]);

  // Save schedule mutation - supports multiple round assignments
  const saveScheduleMutation = useMutation({
    mutationFn: async ({ roundId, dayKey, driverId, remove = false, assignmentId }: {
      roundId: string;
      dayKey: string;
      driverId?: string;
      remove?: boolean;
      assignmentId?: string;
    }) => {
      const scheduledDate = format(weekDays.find(day => format(day, 'EEE') === dayKey)!, 'yyyy-MM-dd');
      
      if (remove && assignmentId) {
        // Remove specific assignment
        const { error } = await supabase
          .from('schedules')
          .delete()
          .eq('id', assignmentId);
        
        if (error) throw error;
        return;
      }

      if (!driverId || !roundId) return;

      // Check if this driver already has this round on this day
      const existingAssignment = scheduleAssignments?.find(assignment => 
        assignment.driver_id === driverId &&
        assignment.round_id === roundId &&
        format(new Date(assignment.scheduled_date), 'EEE') === dayKey
      );

      if (existingAssignment) {
        toast({
          title: "Assignment already exists",
          description: "This driver is already assigned to this round on this day.",
          variant: "destructive",
        });
        return;
      }

      // Get driver rate
      const driver = drivers?.find(d => d.id === driverId);
      const round = rounds?.find(r => r.id === roundId);
      const driverRate = round?.rate || driver?.parcel_rate || 0;

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

  const getDriverAssignments = (driverId: string, dayKey: string) => {
    return schedule[driverId]?.[dayKey] || [];
  };

  const isRoundAssigned = (roundId: string, dayKey: string) => {
    return scheduleAssignments?.some(assignment => 
      assignment.round_id === roundId && 
      format(new Date(assignment.scheduled_date), 'EEE') === dayKey
    );
  };

  const handleAddAssignment = (roundId: string, dayKey: string, driverId: string) => {
    setHasUnsavedChanges(true);
    saveScheduleMutation.mutate({ roundId, dayKey, driverId });
  };

  const handleRemoveAssignment = (assignmentId: string, roundId: string, dayKey: string) => {
    setHasUnsavedChanges(true);
    saveScheduleMutation.mutate({ roundId, dayKey, remove: true, assignmentId });
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

      {/* Driver-Based Schedule Grid */}
      <Card>
        <CardHeader>
          <CardTitle>Driver Schedule Matrix</CardTitle>
          <CardDescription>
            Assign multiple rounds to each driver per day
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
                    <th className="text-left p-3 border border-border font-medium min-w-[180px] bg-muted/50">
                      Driver
                    </th>
                    {weekDays.map((day, index) => (
                      <th key={index} className="text-center p-3 border border-border font-medium min-w-[200px] bg-muted/50">
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
                  {drivers?.map((driver) => (
                    <tr key={driver.id} className="hover:bg-muted/30">
                      <td className="p-3 border border-border bg-muted/30">
                        <div className="font-medium">
                          {driver.profiles?.first_name} {driver.profiles?.last_name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          £{driver.parcel_rate || 0}/parcel base rate
                        </div>
                      </td>
                      {weekDays.map((day, dayIndex) => {
                        const dayKey = format(day, 'EEE');
                        const assignments = getDriverAssignments(driver.id, dayKey);
                        
                        return (
                          <td key={dayIndex} className="p-2 border border-border">
                            <div className="space-y-2 min-h-[120px]">
                              {/* Existing Assignments */}
                              {assignments.map((assignment, idx) => (
                                <div key={idx} className="bg-green-50 border border-green-200 rounded p-2">
                                  <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                      <div className="font-medium text-xs">
                                        {assignment.round?.round_number}
                                      </div>
                                      <div className="text-xs text-green-600 font-medium">
                                        £{assignment.driver_rate}/parcel
                                      </div>
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                                      onClick={() => handleRemoveAssignment(assignment.id, assignment.round_id, dayKey)}
                                    >
                                      ×
                                    </Button>
                                  </div>
                                </div>
                              ))}
                              
                              {/* Add New Assignment */}
                              <Select
                                value=""
                                onValueChange={(roundId) => {
                                  if (roundId && roundId !== '__placeholder__') {
                                    handleAddAssignment(roundId, dayKey, driver.id);
                                  }
                                }}
                              >
                                <SelectTrigger className="w-full text-xs bg-background border-dashed border-primary/50">
                                  <SelectValue placeholder="+ Add round" />
                                </SelectTrigger>
                                <SelectContent>
                                  {rounds?.map((round) => (
                                    <SelectItem key={round.id} value={round.id}>
                                      {round.round_number}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
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