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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Package, Clock, CheckCircle2, Truck, MapPin, AlertTriangle, Check, Upload, Shield, Wifi, WifiOff, Battery, Play } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { sanitizeInput } from '@/lib/security';
import { useGeolocation } from '@/hooks/useGeolocation';
import { format } from 'date-fns';

const StartOfDay = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Location tracking integration
  const {
    isTracking,
    shift,
    currentLocation,
    permissionGranted,
    consentGiven,
    setConsentGiven,
    startShift,
    endShift,
    requestPermissions,
    offlineQueueLength,
    captureLocationWithFallbacks
  } = useGeolocation();
  
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
  const [showLocationConsent, setShowLocationConsent] = useState(false);
  const [locationTrackingStarted, setLocationTrackingStarted] = useState(false);

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

  // Start of day mutation
  const startDayMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
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

      const logData = {
        driver_id: driverProfile.id,
        company_id: profile.company_id,
        name: `${profile.first_name} ${profile.last_name}`.trim(),
        round_number: 'Manual Entry',
        total_deliveries: parseInt(data.parcelCount),
        screenshot_url: screenshotUrl,
        processing_status: 'manual',
        manifest_date: today
      };

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

      // If screenshot was uploaded, also create a SOD report for processing
      if (screenshotUrl) {
        const { data: reportData, error: reportError } = await supabase
          .from('start_of_day_reports')
          .insert({
            driver_id: driverProfile.id,
            company_id: profile.company_id,
            driver_name: `${profile.first_name} ${profile.last_name}`.trim(),
            round_number: 'TBD', // Will be extracted by Vision API
            screenshot_url: screenshotUrl,
            processing_status: 'pending'
          })
          .select()
          .single();

        if (!reportError && reportData) {
          // Call Vision API to process screenshot
          try {
            await supabase.functions.invoke('sod-vision-ocr', {
              body: {
                screenshotPath: screenshotUrl,
                reportId: reportData.id
              }
            });
          } catch (visionError) {
            console.error('Vision API processing failed:', visionError);
          }
        }
      }

      return result;
    },
    onSuccess: async (data) => {
      setSuccessData(data);
      
      // Auto-start location tracking after successful SOD submission
      if (permissionGranted && consentGiven) {
        const trackingStarted = await startShift();
        setLocationTrackingStarted(trackingStarted);
      } else if (!consentGiven) {
        setShowLocationConsent(true);
      }
      
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
    console.log('SOD form submitted, checking validation...');
    
    if (!validateForm()) {
      toast({
        title: "Please fix the errors",
        description: "Check all required fields and try again",
        variant: "destructive",
      });
      return;
    }

    console.log('Form validated, checking location permissions and consent...', { 
      permissionGranted, 
      consentGiven, 
      userAgent: navigator.userAgent 
    });

    // Always ensure fresh permission check and request if needed
    let locationReady = permissionGranted;
    
    if (!locationReady) {
      console.log('Requesting location permissions...');
      locationReady = await requestPermissions();
      console.log('Permission request result:', locationReady);
    }
    
    if (!locationReady) {
      toast({
        title: "Location Access Required",
        description: "Location tracking is mandatory for delivery shifts. Please allow location access and try again.",
        variant: "destructive",
      });
      return;
    }

    // Auto-grant consent when permissions are confirmed during form submission
    if (!consentGiven) {
      console.log('Auto-granting location tracking consent for SOD submission');
      setConsentGiven(true);
    }

    // Capture initial location to verify geolocation works and show user their location is being tracked
    console.log('Capturing initial location for SOD to verify functionality...');
    try {
      const initialLocation = await captureLocationWithFallbacks();
      if (initialLocation) {
        console.log('Initial location successfully captured for SOD:', initialLocation);
        toast({
          title: "Location Confirmed",
          description: `Starting location captured (±${Math.round(initialLocation.accuracy)}m accuracy)`,
        });
      } else {
        console.warn('Could not capture initial location - this may indicate GPS issues');
        // Still allow form submission as tracking will handle fallbacks during the shift
        toast({
          title: "Location Detection Limited",
          description: "Using network-based location. GPS may be unavailable on this device.",
        });
      }
    } catch (locationError) {
      console.error('Initial location capture failed:', locationError);
      toast({
        title: "Location Warning",
        description: "Location services may be limited. Shift tracking will use available location methods.",
      });
      // Continue with form submission - the tracking system has multiple fallbacks
    }

    console.log('All checks passed, submitting SOD form...');
    startDayMutation.mutate(formData);
  };

  const handleLocationConsentAccept = async () => {
    setConsentGiven(true);
    setShowLocationConsent(false);
    const trackingStarted = await startShift();
    setLocationTrackingStarted(trackingStarted);
    
    if (trackingStarted) {
      toast({
        title: "Location Tracking Started",
        description: "Your location is now being tracked for this shift.",
      });
    }
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
              <CardContent>
                {isAlreadyStarted ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center p-4 rounded-lg bg-card/50">
                         <div className="text-2xl font-bold text-gradient">
                           N/A
                        </div>
                        <div className="text-sm text-muted-foreground">Parcels</div>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-card/50">
                         <div className="text-2xl font-bold text-gradient">
                           N/A
                        </div>
                        <div className="text-sm text-muted-foreground">Start Mileage</div>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-card/50">
                         <div className="text-sm text-success">
                           Started at {new Date(todayLog.created_at).toLocaleTimeString()}
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
                     {todayLog.round_number && (
                       <div className="p-4 bg-muted rounded-lg">
                         <Label className="text-sm font-medium">Round:</Label>
                         <p className="text-sm mt-1">{todayLog.round_number}</p>
                      </div>
                     )}
                     
                     {/* Location Tracking Status */}
                     {isTracking && (
                       <Alert className="border-green-200 bg-green-50 dark:bg-green-950">
                         <MapPin className="h-4 w-4 text-green-600" />
                         <AlertDescription className="text-green-800 dark:text-green-200">
                           <div className="flex items-center justify-between">
                             <span className="font-medium">Location Tracking: ON</span>
                             <div className="flex items-center gap-2">
                               {offlineQueueLength > 0 ? (
                                 <WifiOff className="h-4 w-4 text-orange-500" />
                               ) : (
                                 <Wifi className="h-4 w-4 text-green-500" />
                               )}
                               {currentLocation?.batteryLevel && (
                                 <div className="flex items-center gap-1">
                                   <Battery className="h-3 w-3" />
                                   <span className="text-xs">{currentLocation.batteryLevel}%</span>
                                 </div>
                               )}
                             </div>
                           </div>
                           {shift.startTime && (
                             <div className="text-xs mt-1">
                               Started at {format(shift.startTime, 'HH:mm')}
                               {offlineQueueLength > 0 && (
                                 <span className="ml-2 text-orange-600">
                                   ({offlineQueueLength} updates queued)
                                 </span>
                               )}
                             </div>
                           )}
                         </AlertDescription>
                       </Alert>
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
                    {/* Processing Hint */}
                    <div className="p-4 bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-lg">
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
                            <Package className="w-4 h-4 text-primary" />
                          </div>
                        </div>
                        <div className="flex-grow">
                          <h3 className="text-sm font-medium text-foreground mb-1">
                            Enhanced Data Processing
                          </h3>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            Take a screenshot of your parcel manifest after completing your start of day. Our system will automatically process and extract parcel count information using advanced OCR technology.
                          </p>
                        </div>
                      </div>
                    </div>

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
                    
                    {/* Optional Screenshot Upload */}
                    <div className="space-y-2">
                      <Label htmlFor="screenshot">Manifest Screenshot (Optional)</Label>
                      <div className="flex items-center space-x-2">
                        <Input
                          id="screenshot"
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          className="file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-sm file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                        />
                        <Upload className="h-4 w-4 text-muted-foreground" />
                      </div>
                      {formData.screenshot && (
                        <p className="text-sm text-success">
                          ✓ Selected: {formData.screenshot.name}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Upload a manifest screenshot for automatic parcel type extraction (optional).
                      </p>
                    </div>

                     {/* Notes */}
                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes (Optional)</Label>
                      <Textarea
                        id="notes"
                        placeholder="Any additional notes or observations..."
                        value={formData.notes}
                        onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                        className="min-h-[80px]"
                      />
                    </div>

                     {/* Location Permission Notice */}
                     {!permissionGranted && (
                       <Alert>
                         <Shield className="h-4 w-4" />
                         <AlertDescription>
                           <div className="space-y-2">
                             <p className="font-medium">Location tracking will be enabled when you start your day.</p>
                             <div className="text-sm space-y-1">
                               <p>We use multiple fallback methods to ensure reliable location capture:</p>
                               <ul className="list-disc list-inside space-y-1 text-xs ml-2">
                                 <li>High-precision GPS (when available)</li>
                                 <li>Network-based location (WiFi/cell towers)</li>
                                 <li>IP-based approximate location (fallback)</li>
                               </ul>
                             </div>
                           </div>
                         </AlertDescription>
                       </Alert>
                     )}

                     {permissionGranted && (
                       <Alert className="border-green-200 bg-green-50 dark:bg-green-950">
                         <CheckCircle2 className="h-4 w-4 text-green-600" />
                         <AlertDescription className="text-green-800 dark:text-green-200">
                           <div className="flex items-center justify-between">
                             <span className="font-medium">Location access ready</span>
                             {currentLocation && (
                               <span className="text-xs">
                                 Accuracy: {Math.round(currentLocation.accuracy)}m
                               </span>
                             )}
                           </div>
                         </AlertDescription>
                       </Alert>
                     )}

                     <Button 
                       type="submit"
                       disabled={startDayMutation.isPending || !!errors.vanAssignment}
                       className="logistics-button w-full"
                     >
                       {startDayMutation.isPending ? (
                         <div className="flex items-center">
                           <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                           Starting Day...
                         </div>
                       ) : (
                         <>
                           <Play className="h-4 w-4 mr-2" />
                           Start My Day & Begin Tracking
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
                   <div className="font-semibold text-lg">{successData.total_deliveries}</div>
                   <div className="text-muted-foreground">Parcels</div>
                 </div>
                 <div className="text-center p-3 bg-card/50 rounded-lg">
                   <div className="font-semibold text-lg">Manual Entry</div>
                   <div className="text-muted-foreground">Entry Type</div>
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
                   <span>{new Date(successData.submitted_at).toLocaleTimeString()}</span>
                </div>
              </div>

               {successData.round_number && (
                 <div className="p-3 bg-muted rounded-lg">
                   <Label className="text-xs font-medium">Round:</Label>
                   <p className="text-sm mt-1">{successData.round_number}</p>
                 </div>
               )}

               {/* Location Tracking Status in Success Dialog */}
               <div className="flex items-center justify-between text-sm">
                 <span>Location Tracking:</span>
                 <span className="flex items-center">
                   {locationTrackingStarted ? (
                     <>
                       <Check className="w-4 h-4 mr-1 text-success" />
                       <span className="text-success">Started</span>
                     </>
                   ) : (
                     <>
                       <AlertTriangle className="w-4 h-4 mr-1 text-orange-500" />
                       <span className="text-orange-600">Consent Required</span>
                     </>
                   )}
                 </span>
               </div>
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

       {/* Location Consent Dialog */}
       <Dialog open={showLocationConsent} onOpenChange={setShowLocationConsent}>
         <DialogContent className="sm:max-w-md">
           <DialogHeader>
             <DialogTitle className="flex items-center gap-2">
               <Shield className="h-5 w-5" />
               Location Tracking Consent Required
             </DialogTitle>
           </DialogHeader>
           
           <div className="space-y-4">
             <div className="text-sm text-muted-foreground space-y-2">
               <p>
                 <strong>Your shift has started successfully!</strong> Now we need your consent to begin location tracking.
               </p>
               <p>
                 <strong>Purpose:</strong> We track your location during shifts for:
               </p>
               <ul className="list-disc list-inside space-y-1 ml-4">
                 <li>Safety monitoring and emergency support</li>
                 <li>Route optimization and assistance</li>
                 <li>Accurate delivery verification</li>
               </ul>
               
               <p className="mt-3">
                 <strong>Privacy:</strong> Location data is only collected during work hours and kept for 30 days.
               </p>
             </div>

             <div className="flex items-center space-x-2">
               <Checkbox 
                 id="shift-consent" 
                 checked={consentGiven}
                 onCheckedChange={(checked) => setConsentGiven(checked as boolean)}
               />
               <label 
                 htmlFor="shift-consent" 
                 className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
               >
                 I consent to location tracking for this shift
               </label>
             </div>

             <div className="flex gap-2">
               <Button 
                 variant="outline" 
                 onClick={() => setShowLocationConsent(false)}
                 className="flex-1"
               >
                 Skip for Now
               </Button>
               <Button 
                 onClick={handleLocationConsentAccept}
                 disabled={!consentGiven}
                 className="flex-1"
               >
                 <Play className="h-4 w-4 mr-2" />
                 Start Tracking
               </Button>
             </div>
           </div>
         </DialogContent>
       </Dialog>
     </SidebarProvider>
   );
 };

export default StartOfDay;