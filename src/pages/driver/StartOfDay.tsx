import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Package, Clock, CheckCircle2, Truck, MapPin } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

const StartOfDay = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    parcelCount: '',
    mileage: '',
    notes: ''
  });

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

  // Get today's log
  const { data: todayLog, isLoading } = useQuery({
    queryKey: ['today-log', driverProfile?.id, today],
    queryFn: async () => {
      if (!driverProfile?.id) return null;
      const { data } = await supabase
        .from('daily_logs')
        .select('*')
        .eq('driver_id', driverProfile.id)
        .eq('log_date', today)
        .maybeSingle();
      return data;
    },
    enabled: !!driverProfile?.id
  });

  // Get assigned van info
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

  // Get today's round
  const { data: todayRound } = useQuery({
    queryKey: ['today-round', todayLog?.round_id],
    queryFn: async () => {
      if (!todayLog?.round_id) return null;
      const { data } = await supabase
        .from('rounds')
        .select('*')
        .eq('id', todayLog.round_id)
        .single();
      return data;
    },
    enabled: !!todayLog?.round_id
  });

  // Start of day mutation
  const startDayMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!driverProfile?.id || !profile?.company_id) {
        throw new Error('Driver profile not found');
      }

      const logData = {
        driver_id: driverProfile.id,
        company_id: profile.company_id,
        van_id: driverProfile.assigned_van_id,
        log_date: today,
        sod_parcel_count: parseInt(data.parcelCount),
        sod_mileage: parseInt(data.mileage),
        sod_notes: data.notes,
        sod_timestamp: new Date().toISOString(),
        status: 'in_progress'
      };

      const { error } = await supabase
        .from('daily_logs')
        .upsert(logData);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Start of day logged successfully",
        description: "Your day has been started. Have a safe delivery!",
      });
      queryClient.invalidateQueries({ queryKey: ['today-log'] });
      navigate('/dashboard');
    },
    onError: (error) => {
      toast({
        title: "Error starting day",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.parcelCount || !formData.mileage) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    startDayMutation.mutate(formData);
  };

  const isAlreadyStarted = todayLog?.sod_timestamp;

  if (isLoading) {
    return (
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-background">
          <AppSidebar />
          <SidebarInset className="flex-1">
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p>Loading...</p>
              </div>
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        
        <SidebarInset className="flex-1">
          <header className="border-b bg-card sticky top-0 z-10">
            <div className="flex items-center px-4 py-4">
              <SidebarTrigger className="mr-4" />
              <div>
                <h1 className="text-xl font-semibold text-foreground">Start of Day</h1>
                <p className="text-sm text-muted-foreground">Begin your delivery shift</p>
              </div>
            </div>
          </header>

          <main className="p-6 space-y-6">
            {/* Status Card */}
            <Card className="logistics-card">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Clock className="h-5 w-5 text-primary mr-2" />
                  Today's Status
                  {isAlreadyStarted && (
                    <Badge variant="default" className="ml-2">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Started
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {new Date().toLocaleDateString('en-GB', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isAlreadyStarted ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center p-4 rounded-lg bg-card/50">
                        <div className="text-2xl font-bold text-gradient">
                          {todayLog.sod_parcel_count || 0}
                        </div>
                        <div className="text-sm text-muted-foreground">Parcels</div>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-card/50">
                        <div className="text-2xl font-bold text-gradient">
                          {todayLog.sod_mileage || 0}
                        </div>
                        <div className="text-sm text-muted-foreground">Start Mileage</div>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-card/50">
                        <div className="text-sm text-success">
                          Started at {new Date(todayLog.sod_timestamp).toLocaleTimeString()}
                        </div>
                        <div className="text-sm text-muted-foreground">Time</div>
                      </div>
                    </div>
                    {todayLog.sod_notes && (
                      <div className="p-4 bg-muted rounded-lg">
                        <Label className="text-sm font-medium">Notes:</Label>
                        <p className="text-sm mt-1">{todayLog.sod_notes}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">Ready to start your day?</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Assigned Van Info */}
            {assignedVan && (
              <Card className="logistics-card">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Truck className="h-5 w-5 text-primary mr-2" />
                    Assigned Vehicle
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label className="text-sm font-medium">Registration</Label>
                      <p className="text-lg font-semibold">{assignedVan.registration}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Make & Model</Label>
                      <p className="text-lg">{assignedVan.make} {assignedVan.model}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Year</Label>
                      <p className="text-lg">{assignedVan.year}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Round Info */}
            {todayRound && (
              <Card className="logistics-card">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <MapPin className="h-5 w-5 text-primary mr-2" />
                    Today's Round
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium">Round Number</Label>
                      <p className="text-lg font-semibold">{todayRound.round_number}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Base Rate</Label>
                      <p className="text-lg">£{todayRound.base_rate || 'Not set'}</p>
                    </div>
                  </div>
                  {todayRound.description && (
                    <div className="mt-4">
                      <Label className="text-sm font-medium">Description</Label>
                      <p className="text-sm text-muted-foreground mt-1">{todayRound.description}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Start of Day Form */}
            {!isAlreadyStarted && (
              <Card className="logistics-card">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Package className="h-5 w-5 text-primary mr-2" />
                    Start Your Day
                  </CardTitle>
                  <CardDescription>
                    Enter your starting information to begin your shift
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="parcelCount">
                          Parcel Count <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="parcelCount"
                          type="number"
                          value={formData.parcelCount}
                          onChange={(e) => setFormData(prev => ({ ...prev, parcelCount: e.target.value }))}
                          placeholder="Enter total parcels"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="mileage">
                          Starting Mileage <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="mileage"
                          type="number"
                          value={formData.mileage}
                          onChange={(e) => setFormData(prev => ({ ...prev, mileage: e.target.value }))}
                          placeholder="Enter vehicle mileage"
                          required
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes (Optional)</Label>
                      <Textarea
                        id="notes"
                        value={formData.notes}
                        onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                        placeholder="Any notes or observations about your van or route..."
                        rows={3}
                      />
                    </div>

                    <Button 
                      type="submit" 
                      className="logistics-button w-full"
                      disabled={startDayMutation.isPending}
                      size="lg"
                    >
                      {startDayMutation.isPending ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                          Starting Day...
                        </>
                      ) : (
                        <>
                          <Clock className="h-4 w-4 mr-2" />
                          Start My Day
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="logistics-card hover-lift click-shrink group">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Truck className="h-5 w-5 text-primary mr-2" />
                    Vehicle Check
                  </CardTitle>
                  <CardDescription>
                    Perform daily vehicle inspection
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    className="logistics-button w-full"
                    onClick={() => navigate('/driver/vehicle-check')}
                  >
                    <Truck className="h-4 w-4 mr-2" />
                    Vehicle Check
                  </Button>
                </CardContent>
              </Card>

              <Card className="logistics-card hover-lift click-shrink group">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <MapPin className="h-5 w-5 text-primary mr-2" />
                    Route Info
                  </CardTitle>
                  <CardDescription>
                    View your delivery route details
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    className="logistics-button w-full"
                    variant="outline"
                  >
                    <MapPin className="h-4 w-4 mr-2" />
                    View Route
                  </Button>
                </CardContent>
              </Card>
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default StartOfDay;