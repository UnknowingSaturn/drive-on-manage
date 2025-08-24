import React, { useState, useEffect } from 'react';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Package, Clock, CheckCircle2, Truck, AlertTriangle, Check, Upload } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { sanitizeInput } from '@/lib/security';
import { format } from 'date-fns';

const StartOfDay = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    parcelCount: '',
    mileage: '',
    notes: '',
    vanConfirmed: false,
    screenshot: null as File | null
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
        .from('start_of_day_reports')
        .select('*')
        .eq('driver_id', driverProfile.id)
        .gte('submitted_at', `${today}T00:00:00.000Z`)
        .lt('submitted_at', `${today}T23:59:59.999Z`)
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

  const startDayMutation = useMutation({
    mutationFn: async (data: { parcelCount: string; mileage: string; notes: string; vanConfirmed: boolean; screenshot: File | null }) => {
      if (!driverProfile?.id || !profile?.company_id) {
        throw new Error('Driver profile not found');
      }

      let screenshotUrl = null;

      // Upload screenshot if provided
      if (data.screenshot) {
        const fileExt = data.screenshot.name.split('.').pop();
        const fileName = `${profile?.user_id}/sod-${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('sod-screenshots')
          .upload(fileName, data.screenshot);

        if (uploadError) {
          throw new Error(`Failed to upload screenshot: ${uploadError.message}`);
        }
        screenshotUrl = fileName;
      }

      const { data: result, error } = await supabase
        .from('start_of_day_reports')
        .insert({
          driver_id: driverProfile.id,
          company_id: profile.company_id,
          driver_name: `${profile.first_name} ${profile.last_name}`.trim(),
          round_number: 'TBD', // Will be extracted from screenshot
          heavy_parcels: 0,
          standard: 0,
          hanging_garments: 0,
          packets: 0,
          small_packets: 0,
          postables: 0,
          screenshot_url: screenshotUrl,
          processing_status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;

      // If screenshot was uploaded, process it
      if (screenshotUrl) {
        try {
          await supabase.functions.invoke('sod-vision-ocr', {
            body: {
              screenshotPath: screenshotUrl,
              reportId: result.id
            }
          });
        } catch (visionError) {
          console.error('Vision API processing failed:', visionError);
        }
      }

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

  const handleSubmit = async (e: React.FormEvent) => {
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid File",
          description: "Please select an image file.",
          variant: "destructive",
        });
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "Please select an image smaller than 5MB.",
          variant: "destructive",
        });
        return;
      }

      setFormData(prev => ({ ...prev, screenshot: file }));
    }
  };

  const isAlreadyStarted = todayLog?.created_at;

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
            </Card>

            {showSuccess ? (
              <Card className="logistics-card">
                <CardContent className="text-center py-8">
                  <CheckCircle2 className="h-16 w-16 text-success mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">Day Started Successfully!</h3>
                  <p className="text-muted-foreground mb-4">
                    Your start of day report has been submitted.
                  </p>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>Time: {format(new Date(), 'HH:mm')}</p>
                    {successData && (
                      <p>Report ID: {successData.id.slice(0, 8)}...</p>
                    )}
                  </div>
                  <Button 
                    onClick={() => navigate('/dashboard')}
                    className="mt-4"
                  >
                    Go to Dashboard
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card className="logistics-card">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Package className="h-5 w-5 text-primary mr-2" />
                    Start of Day Form
                  </CardTitle>
                  <CardDescription>
                    Complete your daily startup checklist to begin your shift
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Driver & Van Info */}
                    <div className="bg-muted p-4 rounded-lg space-y-3">
                      <h3 className="font-semibold">Driver & Vehicle Information</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label>Driver Name</Label>
                          <div className="mt-1 text-sm font-medium">
                            {profile?.first_name} {profile?.last_name}
                          </div>
                        </div>
                        {assignedVan && (
                          <div>
                            <Label>Assigned Van</Label>
                            <div className="mt-1 text-sm font-medium">
                              {assignedVan.make} {assignedVan.model} - {assignedVan.registration}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {errors.vanAssignment && (
                        <Alert variant="destructive">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription>{errors.vanAssignment}</AlertDescription>
                        </Alert>
                      )}
                    </div>

                    {/* Form Fields */}
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="parcelCount">Starting Parcel Count *</Label>
                        <Input
                          id="parcelCount"
                          type="number"
                          min="0"
                          value={formData.parcelCount}
                          onChange={(e) => setFormData(prev => ({ ...prev, parcelCount: sanitizeInput(e.target.value) }))}
                          className={errors.parcelCount ? 'border-destructive' : ''}
                        />
                        {errors.parcelCount && <p className="text-destructive text-sm mt-1">{errors.parcelCount}</p>}
                      </div>

                      <div>
                        <Label htmlFor="mileage">Starting Mileage *</Label>
                        <Input
                          id="mileage"
                          type="number"
                          min="0"
                          value={formData.mileage}
                          onChange={(e) => setFormData(prev => ({ ...prev, mileage: sanitizeInput(e.target.value) }))}
                          className={errors.mileage ? 'border-destructive' : ''}
                        />
                        {errors.mileage && <p className="text-destructive text-sm mt-1">{errors.mileage}</p>}
                      </div>

                      <div>
                        <Label htmlFor="notes">Notes (Optional)</Label>
                        <Textarea
                          id="notes"
                          value={formData.notes}
                          onChange={(e) => setFormData(prev => ({ ...prev, notes: sanitizeInput(e.target.value) }))}
                          placeholder="Any additional notes for today's shift..."
                        />
                      </div>
                    </div>

                    {/* Vehicle Check */}
                    <div className="space-y-4">
                      <Label>Vehicle Safety Check *</Label>
                      {errors.vehicleCheck && (
                        <Alert variant="destructive">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription>{errors.vehicleCheck}</AlertDescription>
                        </Alert>
                      )}
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {Object.entries(vehicleCheck).map(([key, checked]) => (
                          <div key={key} className="flex items-center space-x-2">
                            <Checkbox
                              id={key}
                              checked={checked}
                              onCheckedChange={(checked) => handleVehicleCheckChange(key, !!checked)}
                            />
                            <Label htmlFor={key} className="capitalize">
                              {key.replace(/([A-Z])/g, ' $1').trim()}
                            </Label>
                            {checked && <Check className="h-4 w-4 text-success" />}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Van Confirmation */}
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="vanConfirmed"
                        checked={formData.vanConfirmed}
                        onCheckedChange={(checked) => {
                          setFormData(prev => ({ ...prev, vanConfirmed: !!checked }));
                          if (checked) {
                            setErrors(prev => ({ ...prev, vanConfirmed: '' }));
                          }
                        }}
                      />
                      <Label htmlFor="vanConfirmed">
                        I confirm this is my assigned van and it's ready for service *
                      </Label>
                    </div>
                    {errors.vanConfirmed && <p className="text-destructive text-sm">{errors.vanConfirmed}</p>}

                    {/* Screenshot Upload */}
                    <div className="space-y-2">
                      <Label htmlFor="screenshot">Manifest Screenshot (Optional)</Label>
                      <div className="border-2 border-dashed border-border rounded-lg p-4">
                        <input
                          id="screenshot"
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          className="w-full"
                        />
                        <p className="text-sm text-muted-foreground mt-2">
                          Upload a screenshot of your delivery manifest if available
                        </p>
                      </div>
                    </div>

                    {/* Submit Button */}
                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={startDayMutation.isPending || !!isAlreadyStarted}
                    >
                      {startDayMutation.isPending ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                          Starting Day...
                        </>
                      ) : isAlreadyStarted ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Day Already Started
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
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default StartOfDay;