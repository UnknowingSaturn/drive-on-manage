import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { MobileNav } from '@/components/MobileNav';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Package, Clock, CheckCircle2, Truck, MapPin, AlertTriangle, Check } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { sanitizeInput } from '@/lib/security';

const StartOfDay = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    parcelCount: '',
    mileage: '',
    notes: '',
    vanConfirmed: false
  });

  const [vehicleCheck, setVehicleCheck] = useState({
    lights: false,
    tyres: false,
    brakes: false,
    mirrors: false,
    fuel: false,
    cleanliness: false,
    documentation: false
  });

  const [showSuccess, setShowSuccess] = useState(false);
  const [successData, setSuccessData] = useState<any>(null);
  const [errors, setErrors] = useState<{[key: string]: string}>({});

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

  // Get today's SOD log
  const { data: todayLog, isLoading } = useQuery({
    queryKey: ['today-sod-log', driverProfile?.id, today],
    queryFn: async () => {
      if (!driverProfile?.id) return null;
      const { data } = await supabase
        .from('sod_logs')
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

  const validateForm = () => {
    const newErrors: {[key: string]: string} = {};
    
    if (!formData.parcelCount || parseInt(formData.parcelCount) < 0) {
      newErrors.parcelCount = 'Please enter a valid parcel count';
    }
    
    if (!formData.mileage || parseInt(formData.mileage) < 0) {
      newErrors.mileage = 'Please enter a valid starting mileage';
    }
    
    if (!formData.vanConfirmed) {
      newErrors.vanConfirmed = 'Please confirm your assigned van';
    }

    if (!driverProfile?.assigned_van_id) {
      newErrors.vanAssignment = 'No van assigned. Contact your administrator.';
    }
    
    const vehicleCheckCompleted = Object.values(vehicleCheck).every(checked => checked);
    if (!vehicleCheckCompleted) {
      newErrors.vehicleCheck = 'Please complete all vehicle check items';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

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
        parcel_count: parseInt(data.parcelCount),
        starting_mileage: parseInt(data.mileage),
        notes: data.notes ? sanitizeInput(data.notes) : null,
        van_confirmed: data.vanConfirmed,
        vehicle_check_completed: Object.values(vehicleCheck).every(checked => checked),
        vehicle_check_items: vehicleCheck,
        timestamp: new Date().toISOString()
      };

      const { data: result, error } = await supabase
        .from('sod_logs')
        .insert(logData)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (data) => {
      setSuccessData(data);
      setShowSuccess(true);
      queryClient.invalidateQueries({ queryKey: ['today-sod-log'] });
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
    if (!validateForm()) {
      toast({
        title: "Please fix the errors",
        description: "Check all required fields and try again",
        variant: "destructive",
      });
      return;
    }
    startDayMutation.mutate(formData);
  };

  const handleVehicleCheckChange = (item: string, checked: boolean) => {
    setVehicleCheck(prev => ({ ...prev, [item]: checked }));
    if (errors.vehicleCheck) {
      setErrors(prev => ({ ...prev, vehicleCheck: '' }));
    }
  };

  const isAlreadyStarted = todayLog?.timestamp;

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
      <div className="min-h-screen flex w-full bg-background no-overflow">
        <AppSidebar />
        
        <SidebarInset className="flex-1 no-overflow">
          <header className="border-b bg-card sticky top-0 z-10">
            <div className="flex items-center justify-between mobile-padding py-3 md:py-4">
              <div className="flex items-center space-x-3">
                <SidebarTrigger className="mr-2 hidden md:flex" />
                <MobileNav className="md:hidden" />
                <div>
                  <h1 className="mobile-heading font-semibold text-foreground">Start of Day</h1>
                  <p className="text-xs md:text-sm text-muted-foreground">Begin your delivery shift</p>
                </div>
              </div>
            </div>
          </header>

          <main className="mobile-padding py-4 md:py-6 space-y-4 md:space-y-6 no-overflow">
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
                          {todayLog.parcel_count || 0}
                        </div>
                        <div className="text-sm text-muted-foreground">Parcels</div>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-card/50">
                        <div className="text-2xl font-bold text-gradient">
                          {todayLog.starting_mileage || 0}
                        </div>
                        <div className="text-sm text-muted-foreground">Start Mileage</div>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-card/50">
                        <div className="text-sm text-success">
                          Started at {new Date(todayLog.timestamp).toLocaleTimeString()}
                        </div>
                        <div className="text-sm text-muted-foreground">Time</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-card/50 rounded-lg">
                        <Label className="text-sm font-medium">Vehicle Check</Label>
                        <div className="flex items-center mt-1">
                          <CheckCircle2 className="h-4 w-4 text-success mr-1" />
                          <span className="text-sm text-success">Completed</span>
                        </div>
                      </div>
                      <div className="p-4 bg-card/50 rounded-lg">
                        <Label className="text-sm font-medium">Van Confirmed</Label>
                        <div className="flex items-center mt-1">
                          <CheckCircle2 className="h-4 w-4 text-success mr-1" />
                          <span className="text-sm text-success">Confirmed</span>
                        </div>
                      </div>
                    </div>
                    {todayLog.notes && (
                      <div className="p-4 bg-muted rounded-lg">
                        <Label className="text-sm font-medium">Notes:</Label>
                        <p className="text-sm mt-1">{todayLog.notes}</p>
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
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

            {/* Van Assignment Error */}
            {!driverProfile?.assigned_van_id && !isAlreadyStarted && (
              <Card className="logistics-card border-destructive">
                <CardHeader>
                  <CardTitle className="flex items-center text-destructive">
                    <AlertTriangle className="h-5 w-5 mr-2" />
                    No Van Assigned
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    You don't have a van assigned for today. Please contact your administrator before starting your shift.
                  </p>
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
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Basic Information */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="parcelCount">
                          Parcel Count <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="parcelCount"
                          type="number"
                          min="0"
                          value={formData.parcelCount}
                          onChange={(e) => {
                            setFormData(prev => ({ ...prev, parcelCount: e.target.value }));
                            if (errors.parcelCount) setErrors(prev => ({ ...prev, parcelCount: '' }));
                          }}
                          placeholder="Enter total parcels"
                          className={errors.parcelCount ? 'border-destructive' : ''}
                        />
                        {errors.parcelCount && (
                          <p className="text-sm text-destructive">{errors.parcelCount}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="mileage">
                          Starting Mileage <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="mileage"
                          type="number"
                          min="0"
                          value={formData.mileage}
                          onChange={(e) => {
                            setFormData(prev => ({ ...prev, mileage: e.target.value }));
                            if (errors.mileage) setErrors(prev => ({ ...prev, mileage: '' }));
                          }}
                          placeholder="Enter vehicle mileage"
                          className={errors.mileage ? 'border-destructive' : ''}
                        />
                        {errors.mileage && (
                          <p className="text-sm text-destructive">{errors.mileage}</p>
                        )}
                      </div>
                    </div>

                    {/* Van Confirmation */}
                    {assignedVan && (
                      <div className="space-y-3">
                        <Label className="text-sm font-medium">
                          Vehicle Confirmation <span className="text-destructive">*</span>
                        </Label>
                        <div className="flex items-center space-x-2 p-3 border rounded-lg bg-card/50">
                          <Checkbox
                            id="vanConfirmed"
                            checked={formData.vanConfirmed}
                            onCheckedChange={(checked) => {
                              setFormData(prev => ({ ...prev, vanConfirmed: checked as boolean }));
                              if (errors.vanConfirmed) setErrors(prev => ({ ...prev, vanConfirmed: '' }));
                            }}
                          />
                          <label htmlFor="vanConfirmed" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                            I confirm I am using van: <strong>{assignedVan.registration}</strong> ({assignedVan.make} {assignedVan.model})
                          </label>
                        </div>
                        {errors.vanConfirmed && (
                          <p className="text-sm text-destructive">{errors.vanConfirmed}</p>
                        )}
                      </div>
                    )}

                    {/* Vehicle Check Dropdown */}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">
                        Vehicle Safety Check <span className="text-destructive">*</span>
                      </Label>
                      <div className="space-y-2 p-4 border rounded-lg bg-card/50">
                        <p className="text-sm text-muted-foreground mb-3">
                          Please confirm all items have been checked:
                        </p>
                        {Object.entries({
                          lights: 'All lights working (headlights, indicators, brake lights)',
                          tyres: 'Tyres in good condition (tread depth, no damage)',
                          brakes: 'Brakes functioning properly',
                          mirrors: 'All mirrors clean and properly adjusted',
                          fuel: 'Adequate fuel level for route',
                          cleanliness: 'Vehicle interior and exterior clean',
                          documentation: 'Insurance and registration documents present'
                        }).map(([key, description]) => (
                          <div key={key} className="flex items-center space-x-2">
                            <Checkbox
                              id={key}
                              checked={vehicleCheck[key as keyof typeof vehicleCheck]}
                              onCheckedChange={(checked) => handleVehicleCheckChange(key, checked as boolean)}
                            />
                            <label htmlFor={key} className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                              {description}
                            </label>
                          </div>
                        ))}
                      </div>
                      {errors.vehicleCheck && (
                        <p className="text-sm text-destructive">{errors.vehicleCheck}</p>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="notes">Additional Notes (Optional)</Label>
                      <Textarea
                        id="notes"
                        value={formData.notes}
                        onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                        placeholder="Any notes or observations about your van or route..."
                        rows={3}
                      />
                    </div>

                    {errors.vanAssignment && (
                      <div className="p-3 border border-destructive rounded-lg bg-destructive/10">
                        <p className="text-sm text-destructive">{errors.vanAssignment}</p>
                      </div>
                    )}

                    <Button 
                      type="submit" 
                      className="logistics-button w-full"
                      disabled={startDayMutation.isPending || !driverProfile?.assigned_van_id}
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

      {/* Success Dialog */}
      <AlertDialog open={showSuccess} onOpenChange={setShowSuccess}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-success/10 rounded-full">
              <Check className="w-6 h-6 text-success" />
            </div>
            <AlertDialogTitle className="text-center">Start of Day Complete!</AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              Your shift has been successfully started. Here's a summary:
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          {successData && (
            <div className="space-y-3 my-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="text-center p-3 bg-card/50 rounded-lg">
                  <div className="font-semibold text-lg">{successData.parcel_count}</div>
                  <div className="text-muted-foreground">Parcels</div>
                </div>
                <div className="text-center p-3 bg-card/50 rounded-lg">
                  <div className="font-semibold text-lg">{successData.starting_mileage}</div>
                  <div className="text-muted-foreground">Start Mileage</div>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Vehicle Check:</span>
                  <span className="flex items-center text-success">
                    <Check className="w-4 h-4 mr-1" />
                    Completed
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Van Confirmed:</span>
                  <span className="flex items-center text-success">
                    <Check className="w-4 h-4 mr-1" />
                    Yes
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Started at:</span>
                  <span>{new Date(successData.timestamp).toLocaleTimeString()}</span>
                </div>
              </div>

              {successData.notes && (
                <div className="p-3 bg-muted rounded-lg">
                  <Label className="text-xs font-medium">Notes:</Label>
                  <p className="text-sm mt-1">{successData.notes}</p>
                </div>
              )}
            </div>
          )}
          
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => {
              setShowSuccess(false);
              navigate('/dashboard');
            }}>
              Continue to Dashboard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  );
};

export default StartOfDay;