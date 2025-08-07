import React, { useState, useRef } from 'react';
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
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Package, Clock, CheckCircle2, Camera, Upload, AlertTriangle, DollarSign, FileText, Check } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { sanitizeInput } from '@/lib/security';

const EndOfDay = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    parcelsDelivered: '',
    issues: ''
  });

  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [successData, setSuccessData] = useState<any>(null);
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [isUploading, setIsUploading] = useState(false);

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

  // Get today's EOD report
  const { data: todayEOD, isLoading } = useQuery({
    queryKey: ['today-eod-report', driverProfile?.id, today],
    queryFn: async () => {
      if (!driverProfile?.id) return null;
      const { data } = await supabase
        .from('eod_reports')
        .select('*')
        .eq('driver_id', driverProfile.id)
        .eq('log_date', today)
        .maybeSingle();
      return data;
    },
    enabled: !!driverProfile?.id
  });

  // Get today's SOD log for parcel count validation
  const { data: todaySOD } = useQuery({
    queryKey: ['today-sod-log', driverProfile?.id, today],
    queryFn: async () => {
      if (!driverProfile?.id) return null;
      const { data } = await supabase
        .from('sod_logs')
        .select('parcel_count')
        .eq('driver_id', driverProfile.id)
        .eq('log_date', today)
        .maybeSingle();
      return data;
    },
    enabled: !!driverProfile?.id
  });

  const validateForm = () => {
    const newErrors: {[key: string]: string} = {};
    
    if (!formData.parcelsDelivered || parseInt(formData.parcelsDelivered) < 0) {
      newErrors.parcelsDelivered = 'Please enter a valid number of parcels delivered';
    }

    if (todaySOD && parseInt(formData.parcelsDelivered) > todaySOD.parcel_count) {
      newErrors.parcelsDelivered = `Cannot exceed starting parcel count (${todaySOD.parcel_count})`;
    }
    
    if (!screenshot) {
      newErrors.screenshot = 'Please upload a screenshot of your delivery summary';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const calculateEstimatedPay = () => {
    if (!driverProfile?.parcel_rate || !formData.parcelsDelivered) return 0;
    const parcelCount = parseInt(formData.parcelsDelivered);
    const baseRate = driverProfile.hourly_rate || 0;
    const parcelPay = parcelCount * (driverProfile.parcel_rate || 0);
    return Number((baseRate + parcelPay).toFixed(2));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setErrors(prev => ({ ...prev, screenshot: 'Please upload an image file' }));
        return;
      }
      
      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        setErrors(prev => ({ ...prev, screenshot: 'File size must be less than 5MB' }));
        return;
      }

      setScreenshot(file);
      setPreviewUrl(URL.createObjectURL(file));
      if (errors.screenshot) {
        setErrors(prev => ({ ...prev, screenshot: '' }));
      }
    }
  };

  // End of day mutation
  const endDayMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!driverProfile?.id || !profile?.company_id) {
        throw new Error('Driver profile not found');
      }

      setIsUploading(true);
      
      let screenshotUrl = '';
      if (screenshot) {
        const fileName = `${user?.id}/${Date.now()}-${screenshot.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('eod-screenshots')
          .upload(fileName, screenshot);

        if (uploadError) throw uploadError;
        screenshotUrl = uploadData.path;
      }

      const estimatedPay = calculateEstimatedPay();

      const eodData = {
        driver_id: driverProfile.id,
        company_id: profile.company_id,
        van_id: driverProfile.assigned_van_id,
        log_date: today,
        parcels_delivered: parseInt(data.parcelsDelivered),
        screenshot_url: screenshotUrl,
        issues_reported: data.issues ? sanitizeInput(data.issues) : null,
        estimated_pay: estimatedPay,
        timestamp: new Date().toISOString()
      };

      const { data: result, error } = await supabase
        .from('eod_reports')
        .insert(eodData)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (data) => {
      setSuccessData(data);
      setShowSuccess(true);
      queryClient.invalidateQueries({ queryKey: ['today-eod-report'] });
    },
    onError: (error) => {
      toast({
        title: "Error completing end of day",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsUploading(false);
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
    endDayMutation.mutate(formData);
  };

  const isAlreadyCompleted = todayEOD?.timestamp;
  const canSubmitEOD = todaySOD?.parcel_count;

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
                  <h1 className="mobile-heading font-semibold text-foreground">End of Day</h1>
                  <p className="text-xs md:text-sm text-muted-foreground">Complete your delivery shift</p>
                </div>
              </div>
            </div>
          </header>

          <main className="mobile-padding py-4 md:py-6 space-y-4 md:space-y-6 no-overflow">
            {/* Status Card */}
            <Card className="logistics-card">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Package className="h-5 w-5 text-primary mr-2" />
                  End of Day Summary
                  {isAlreadyCompleted && (
                    <Badge variant="default" className="ml-2">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Completed
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
                {isAlreadyCompleted ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="text-center p-4 rounded-lg bg-card/50">
                        <div className="text-2xl font-bold text-gradient">
                          {todayEOD.parcels_delivered}
                        </div>
                        <div className="text-sm text-muted-foreground">Delivered</div>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-card/50">
                        <div className="text-2xl font-bold text-gradient">
                          £{todayEOD.estimated_pay || 0}
                        </div>
                        <div className="text-sm text-muted-foreground">Estimated Pay</div>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-card/50">
                        <div className="text-sm text-success">
                          Completed at {new Date(todayEOD.timestamp).toLocaleTimeString()}
                        </div>
                        <div className="text-sm text-muted-foreground">Time</div>
                      </div>
                    </div>
                    
                    {todayEOD.screenshot_url && (
                      <div className="p-4 bg-card/50 rounded-lg">
                        <Label className="text-sm font-medium">Screenshot:</Label>
                        <div className="mt-2">
                          <img 
                            src={`${supabase.storage.from('eod-screenshots').getPublicUrl(todayEOD.screenshot_url).data.publicUrl}`}
                            alt="Delivery summary screenshot"
                            className="max-w-sm rounded-lg border"
                          />
                        </div>
                      </div>
                    )}

                    {todayEOD.issues_reported && (
                      <div className="p-4 bg-muted rounded-lg">
                        <Label className="text-sm font-medium">Issues Reported:</Label>
                        <p className="text-sm mt-1">{todayEOD.issues_reported}</p>
                      </div>
                    )}
                  </div>
                ) : !canSubmitEOD ? (
                  <div className="text-center py-8">
                    <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground mb-2">Please complete your Start of Day first</p>
                    <Button 
                      onClick={() => navigate('/driver/start-of-day')}
                      variant="outline"
                    >
                      Go to Start of Day
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">Ready to complete your day?</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pay Calculation Preview */}
            {!isAlreadyCompleted && canSubmitEOD && formData.parcelsDelivered && (
              <Card className="logistics-card">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <DollarSign className="h-5 w-5 text-primary mr-2" />
                    Estimated Pay
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="text-center p-4 rounded-lg bg-card/50">
                      <div className="text-lg font-bold">
                        £{driverProfile?.hourly_rate || 0}
                      </div>
                      <div className="text-sm text-muted-foreground">Base Rate</div>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-card/50">
                      <div className="text-lg font-bold">
                        £{((driverProfile?.parcel_rate || 0) * parseInt(formData.parcelsDelivered || '0')).toFixed(2)}
                      </div>
                      <div className="text-sm text-muted-foreground">Parcel Bonus</div>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-primary/10 border-primary/20">
                      <div className="text-xl font-bold text-primary">
                        £{calculateEstimatedPay()}
                      </div>
                      <div className="text-sm text-muted-foreground">Total Estimated</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* End of Day Form */}
            {!isAlreadyCompleted && canSubmitEOD && (
              <Card className="logistics-card">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <FileText className="h-5 w-5 text-primary mr-2" />
                    Complete Your Day
                  </CardTitle>
                  <CardDescription>
                    Enter your delivery summary and upload a screenshot
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Parcels Delivered */}
                    <div className="space-y-2">
                      <Label htmlFor="parcelsDelivered">
                        Parcels Delivered <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="parcelsDelivered"
                        type="number"
                        min="0"
                        max={todaySOD?.parcel_count || 999}
                        value={formData.parcelsDelivered}
                        onChange={(e) => {
                          setFormData(prev => ({ ...prev, parcelsDelivered: e.target.value }));
                          if (errors.parcelsDelivered) setErrors(prev => ({ ...prev, parcelsDelivered: '' }));
                        }}
                        placeholder={`Enter delivered count (started with ${todaySOD?.parcel_count || 0})`}
                        className={errors.parcelsDelivered ? 'border-destructive' : ''}
                      />
                      {errors.parcelsDelivered && (
                        <p className="text-sm text-destructive">{errors.parcelsDelivered}</p>
                      )}
                    </div>

                    {/* Screenshot Upload */}
                    <div className="space-y-3">
                      <Label>
                        Delivery Summary Screenshot <span className="text-destructive">*</span>
                      </Label>
                      <div className="space-y-3">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full h-20 border-dashed"
                        >
                          <div className="text-center">
                            {screenshot ? (
                              <>
                                <Upload className="h-6 w-6 mx-auto mb-2 text-success" />
                                <p className="text-sm">{screenshot.name}</p>
                              </>
                            ) : (
                              <>
                                <Camera className="h-6 w-6 mx-auto mb-2" />
                                <p className="text-sm">Click to upload screenshot</p>
                              </>
                            )}
                          </div>
                        </Button>
                        
                        {previewUrl && (
                          <div className="mt-3">
                            <img 
                              src={previewUrl} 
                              alt="Screenshot preview" 
                              className="max-w-sm rounded-lg border"
                            />
                          </div>
                        )}
                        
                        {errors.screenshot && (
                          <p className="text-sm text-destructive">{errors.screenshot}</p>
                        )}
                      </div>
                    </div>

                    {/* Issues */}
                    <div className="space-y-2">
                      <Label htmlFor="issues">Issues or Notes (Optional)</Label>
                      <Textarea
                        id="issues"
                        value={formData.issues}
                        onChange={(e) => setFormData(prev => ({ ...prev, issues: e.target.value }))}
                        placeholder="Report any issues, delays, or observations from today's deliveries..."
                        rows={4}
                      />
                    </div>

                    <Button 
                      type="submit" 
                      className="logistics-button w-full"
                      disabled={endDayMutation.isPending || isUploading}
                      size="lg"
                    >
                      {endDayMutation.isPending || isUploading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                          {isUploading ? 'Uploading...' : 'Completing Day...'}
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Complete End of Day
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

      {/* Success Dialog */}
      <AlertDialog open={showSuccess} onOpenChange={setShowSuccess}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-success/10 rounded-full">
              <Check className="w-6 h-6 text-success" />
            </div>
            <AlertDialogTitle className="text-center">End of Day Complete!</AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              Your delivery summary has been recorded. Great work today!
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          {successData && (
            <div className="space-y-3 my-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="text-center p-3 bg-card/50 rounded-lg">
                  <div className="font-semibold text-lg">{successData.parcels_delivered}</div>
                  <div className="text-muted-foreground">Delivered</div>
                </div>
                <div className="text-center p-3 bg-card/50 rounded-lg">
                  <div className="font-semibold text-lg">£{successData.estimated_pay}</div>
                  <div className="text-muted-foreground">Estimated Pay</div>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Status:</span>
                  <span className="flex items-center text-success">
                    <Check className="w-4 h-4 mr-1" />
                    Submitted
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Screenshot:</span>
                  <span className="flex items-center text-success">
                    <Check className="w-4 h-4 mr-1" />
                    Uploaded
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Completed at:</span>
                  <span>{new Date(successData.timestamp).toLocaleTimeString()}</span>
                </div>
              </div>

              {successData.issues_reported && (
                <div className="p-3 bg-muted rounded-lg">
                  <Label className="text-xs font-medium">Issues Reported:</Label>
                  <p className="text-sm mt-1">{successData.issues_reported}</p>
                </div>
              )}
            </div>
          )}
          
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => {
              setShowSuccess(false);
              navigate('/dashboard');
            }}>
              Back to Dashboard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  );
};

export default EndOfDay;