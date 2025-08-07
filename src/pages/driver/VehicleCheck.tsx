import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Truck, Camera, Fuel, Gauge, AlertTriangle, CheckCircle2, Upload } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const VehicleCheck = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    mileage: '',
    fuelLevel: '',
    exteriorCondition: 'good',
    interiorCondition: 'good',
    issuesReported: ''
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

  // Get today's vehicle check
  const { data: todayCheck, isLoading } = useQuery({
    queryKey: ['today-vehicle-check', driverProfile?.id, today],
    queryFn: async () => {
      if (!driverProfile?.id || !assignedVan?.id) return null;
      const { data } = await supabase
        .from('vehicle_checks')
        .select('*')
        .eq('driver_id', driverProfile.id)
        .eq('van_id', assignedVan.id)
        .eq('check_date', today)
        .maybeSingle();
      return data;
    },
    enabled: !!driverProfile?.id && !!assignedVan?.id
  });

  // Vehicle check mutation
  const vehicleCheckMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!driverProfile?.id || !assignedVan?.id) {
        throw new Error('Driver profile or vehicle not found');
      }

      const checkData = {
        driver_id: driverProfile.id,
        van_id: assignedVan.id,
        check_date: today,
        mileage: parseInt(data.mileage),
        fuel_level: parseInt(data.fuelLevel),
        exterior_condition: data.exteriorCondition,
        interior_condition: data.interiorCondition,
        issues_reported: data.issuesReported || null,
        status: 'completed'
      };

      const { error } = await supabase
        .from('vehicle_checks')
        .upsert(checkData);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Vehicle check completed",
        description: "Your vehicle inspection has been recorded successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['today-vehicle-check'] });
    },
    onError: (error) => {
      toast({
        title: "Error completing vehicle check",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.mileage || !formData.fuelLevel) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    vehicleCheckMutation.mutate(formData);
  };

  const handlePhotoUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = async (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      if (files.length === 0) return;

      try {
        toast({
          title: "Uploading photos...",
          description: "Please wait while your photos are being uploaded.",
        });

        // Upload photos to Supabase storage
        const uploadPromises = files.map(async (file) => {
          const fileExt = file.name.split('.').pop();
          const fileName = `${user?.id}/vehicle_check_${Date.now()}_${Math.random()}.${fileExt}`;
          
          const { data, error } = await supabase.storage
            .from('eod-screenshots')
            .upload(fileName, file);

          if (error) throw error;
          return data.path;
        });

        const uploadedPaths = await Promise.all(uploadPromises);

        toast({
          title: "Photos uploaded successfully",
          description: `${uploadedPaths.length} photo(s) uploaded for your vehicle check.`,
        });

      } catch (error: any) {
        toast({
          title: "Upload failed",
          description: error.message || "Failed to upload photos.",
          variant: "destructive",
        });
      }
    };
    input.click();
  };

  const isAlreadyCompleted = !!todayCheck;

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
                <h1 className="text-xl font-semibold text-foreground">Vehicle Check</h1>
                <p className="text-sm text-muted-foreground">Daily vehicle inspection</p>
              </div>
            </div>
          </header>

          <main className="p-6 space-y-6">
            {/* Vehicle Info */}
            {assignedVan && (
              <Card className="logistics-card">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Truck className="h-5 w-5 text-primary mr-2" />
                    Vehicle Information
                    {isAlreadyCompleted && (
                      <Badge variant="default" className="ml-2">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Checked
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
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 rounded-lg bg-card/50">
                      <div className="text-lg font-bold">{assignedVan.registration}</div>
                      <div className="text-sm text-muted-foreground">Registration</div>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-card/50">
                      <div className="text-lg font-bold">{assignedVan.make}</div>
                      <div className="text-sm text-muted-foreground">Make</div>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-card/50">
                      <div className="text-lg font-bold">{assignedVan.model}</div>
                      <div className="text-sm text-muted-foreground">Model</div>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-card/50">
                      <div className="text-lg font-bold">{assignedVan.year}</div>
                      <div className="text-sm text-muted-foreground">Year</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Completed Check Summary */}
            {isAlreadyCompleted && (
              <Card className="logistics-card border-success/50">
                <CardHeader>
                  <CardTitle className="flex items-center text-success">
                    <CheckCircle2 className="h-5 w-5 mr-2" />
                    Vehicle Check Completed
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 rounded-lg bg-card/50">
                      <div className="text-lg font-bold">{todayCheck.mileage}</div>
                      <div className="text-sm text-muted-foreground">Mileage</div>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-card/50">
                      <div className="text-lg font-bold">{todayCheck.fuel_level}%</div>
                      <div className="text-sm text-muted-foreground">Fuel Level</div>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-card/50">
                      <Badge variant={todayCheck.exterior_condition === 'good' ? 'default' : 'destructive'}>
                        {todayCheck.exterior_condition}
                      </Badge>
                      <div className="text-sm text-muted-foreground mt-1">Exterior</div>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-card/50">
                      <Badge variant={todayCheck.interior_condition === 'good' ? 'default' : 'destructive'}>
                        {todayCheck.interior_condition}
                      </Badge>
                      <div className="text-sm text-muted-foreground mt-1">Interior</div>
                    </div>
                  </div>
                  
                  {todayCheck.issues_reported && (
                    <div className="mt-4 p-4 bg-muted rounded-lg">
                      <Label className="text-sm font-medium">Issues Reported:</Label>
                      <p className="text-sm mt-1">{todayCheck.issues_reported}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Vehicle Check Form */}
            {!isAlreadyCompleted && assignedVan && (
              <Card className="logistics-card">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Truck className="h-5 w-5 text-primary mr-2" />
                    Daily Vehicle Inspection
                  </CardTitle>
                  <CardDescription>
                    Complete your daily vehicle check before starting your route
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Vehicle Readings */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="mileage" className="flex items-center">
                          <Gauge className="h-4 w-4 mr-2" />
                          Current Mileage <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="mileage"
                          type="number"
                          value={formData.mileage}
                          onChange={(e) => setFormData(prev => ({ ...prev, mileage: e.target.value }))}
                          placeholder="Enter current mileage"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="fuelLevel" className="flex items-center">
                          <Fuel className="h-4 w-4 mr-2" />
                          Fuel Level (%) <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="fuelLevel"
                          type="number"
                          min="0"
                          max="100"
                          value={formData.fuelLevel}
                          onChange={(e) => setFormData(prev => ({ ...prev, fuelLevel: e.target.value }))}
                          placeholder="Enter fuel level percentage"
                          required
                        />
                      </div>
                    </div>

                    {/* Condition Checks */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <Label className="text-base font-medium">Exterior Condition</Label>
                        <RadioGroup
                          value={formData.exteriorCondition}
                          onValueChange={(value) => setFormData(prev => ({ ...prev, exteriorCondition: value }))}
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="good" id="exterior-good" />
                            <Label htmlFor="exterior-good" className="flex items-center">
                              <CheckCircle2 className="h-4 w-4 text-success mr-2" />
                              Good - No visible damage
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="minor_issues" id="exterior-minor" />
                            <Label htmlFor="exterior-minor" className="flex items-center">
                              <AlertTriangle className="h-4 w-4 text-warning mr-2" />
                              Minor Issues - Small scratches/dents
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="major_issues" id="exterior-major" />
                            <Label htmlFor="exterior-major" className="flex items-center">
                              <AlertTriangle className="h-4 w-4 text-destructive mr-2" />
                              Major Issues - Significant damage
                            </Label>
                          </div>
                        </RadioGroup>
                      </div>

                      <div className="space-y-4">
                        <Label className="text-base font-medium">Interior Condition</Label>
                        <RadioGroup
                          value={formData.interiorCondition}
                          onValueChange={(value) => setFormData(prev => ({ ...prev, interiorCondition: value }))}
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="good" id="interior-good" />
                            <Label htmlFor="interior-good" className="flex items-center">
                              <CheckCircle2 className="h-4 w-4 text-success mr-2" />
                              Good - Clean and functional
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="minor_issues" id="interior-minor" />
                            <Label htmlFor="interior-minor" className="flex items-center">
                              <AlertTriangle className="h-4 w-4 text-warning mr-2" />
                              Minor Issues - Needs cleaning
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="major_issues" id="interior-major" />
                            <Label htmlFor="interior-major" className="flex items-center">
                              <AlertTriangle className="h-4 w-4 text-destructive mr-2" />
                              Major Issues - Damage/malfunction
                            </Label>
                          </div>
                        </RadioGroup>
                      </div>
                    </div>

                    {/* Photo Upload */}
                    <div className="space-y-2">
                      <Label>Vehicle Photos</Label>
                      <div className="border-2 border-dashed border-muted rounded-lg p-6 text-center">
                        <Camera className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground mb-2">
                          Upload photos of any issues or damage
                        </p>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          type="button"
                          onClick={() => handlePhotoUpload()}
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          Take Photos
                        </Button>
                      </div>
                    </div>

                    {/* Issues */}
                    <div className="space-y-2">
                      <Label htmlFor="issues">Issues or Concerns</Label>
                      <Textarea
                        id="issues"
                        value={formData.issuesReported}
                        onChange={(e) => setFormData(prev => ({ ...prev, issuesReported: e.target.value }))}
                        placeholder="Report any issues, concerns, or required maintenance..."
                        rows={3}
                      />
                    </div>

                    <Button 
                      type="submit" 
                      className="logistics-button w-full"
                      disabled={vehicleCheckMutation.isPending}
                      size="lg"
                    >
                      {vehicleCheckMutation.isPending ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                          Completing Check...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Complete Vehicle Check
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* No Assigned Vehicle */}
            {!assignedVan && (
              <Card className="logistics-card border-warning/50">
                <CardHeader>
                  <CardTitle className="flex items-center text-warning">
                    <AlertTriangle className="h-5 w-5 mr-2" />
                    No Assigned Vehicle
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    You don't have a vehicle assigned to you yet. Please contact your administrator to assign you a vehicle.
                  </p>
                </CardContent>
              </Card>
            )}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default VehicleCheck;