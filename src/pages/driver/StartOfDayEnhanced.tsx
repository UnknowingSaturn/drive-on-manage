import React, { useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { MobileNav } from '@/components/MobileNav';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Package, Upload, Eye, Clock, CheckCircle2, Loader2, Camera } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { useGeolocation } from '@/hooks/useGeolocation';

const StartOfDayEnhanced = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { startShift } = useGeolocation();
  
  const [formData, setFormData] = useState({
    roundNumber: '',
    screenshot: null as File | null
  });

  const [showSuccess, setShowSuccess] = useState(false);
  const [successData, setSuccessData] = useState<any>(null);
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

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

  // Get available rounds for this driver
  const { data: availableRounds } = useQuery({
    queryKey: ['driver-rounds', driverProfile?.id],
    queryFn: async () => {
      if (!driverProfile?.id || !profile?.company_id) return [];
      
      // Get current week's schedules for this driver
      const startOfWeek = new Date();
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 6);

      const { data } = await supabase
        .from('schedules')
        .select(`
          round_id,
          rounds!inner(
            id,
            round_number,
            description
          )
        `)
        .eq('driver_id', driverProfile.id)
        .gte('scheduled_date', startOfWeek.toISOString().split('T')[0])
        .lte('scheduled_date', endOfWeek.toISOString().split('T')[0]);

      return data?.map(s => s.rounds).filter(Boolean) || [];
    },
    enabled: !!driverProfile?.id && !!profile?.company_id
  });

  // Check if already submitted today
  const { data: todayReport, isLoading } = useQuery({
    queryKey: ['today-sod-report', driverProfile?.id, today],
    queryFn: async () => {
      if (!driverProfile?.id) return null;
      const { data } = await supabase
        .from('start_of_day_reports')
        .select('*')
        .eq('driver_id', driverProfile.id)
        .gte('submitted_at', `${today}T00:00:00Z`)
        .lt('submitted_at', `${today}T23:59:59Z`)
        .maybeSingle();
      return data;
    },
    enabled: !!driverProfile?.id
  });

  const validateForm = () => {
    const newErrors: {[key: string]: string} = {};
    
    if (!formData.roundNumber) {
      newErrors.roundNumber = 'Please select a round number';
    }
    
    if (!formData.screenshot) {
      newErrors.screenshot = 'Please upload a screenshot of your manifest';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        setErrors(prev => ({ ...prev, screenshot: 'File size must be less than 10MB' }));
        return;
      }
      
      if (!file.type.startsWith('image/')) {
        setErrors(prev => ({ ...prev, screenshot: 'Please upload an image file' }));
        return;
      }

      setFormData(prev => ({ ...prev, screenshot: file }));
      setErrors(prev => ({ ...prev, screenshot: '' }));
      
      // Create preview URL
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  // Start of day submission mutation
  const submitMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!driverProfile?.id || !profile?.company_id || !data.screenshot) {
        throw new Error('Missing required data');
      }

      setIsProcessing(true);
      
      // Upload screenshot to storage
      const fileName = `${driverProfile.user_id}/${Date.now()}-${data.screenshot.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('sod-screenshots')
        .upload(fileName, data.screenshot);

      if (uploadError) throw uploadError;

      // Create report record
      const reportData = {
        driver_id: driverProfile.id,
        company_id: profile.company_id,
        name: `${profile.first_name} ${profile.last_name}`,
        round_number: data.roundNumber,
        screenshot_url: uploadData.path,
        processing_status: 'processing'
      };

      const { data: report, error: reportError } = await supabase
        .from('start_of_day_reports')
        .insert(reportData)
        .select()
        .single();

      if (reportError) throw reportError;

      // Convert image to base64 for Vision API
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(data.screenshot!);
      });

      // Call Vision API for OCR processing
      const { data: visionResult, error: visionError } = await supabase.functions.invoke('vision-ocr', {
        body: {
          imageData: base64,
          reportId: report.id
        }
      });

      if (visionError) {
        console.error('Vision API error:', visionError);
        // Continue without failing - manual entry is still possible
      }

      // Start location tracking
      try {
        await startShift();
        console.log('Location tracking started successfully');
      } catch (trackingError) {
        console.error('Failed to start location tracking:', trackingError);
        // Don't fail the submission if tracking fails
      }

      return { report, visionResult };
    },
    onSuccess: (data) => {
      setSuccessData(data.report);
      setShowSuccess(true);
      setIsProcessing(false);
      queryClient.invalidateQueries({ queryKey: ['today-sod-report'] });
      
      toast({
        title: "Start of Day submitted successfully",
        description: "Your manifest has been processed and location tracking has started",
      });
    },
    onError: (error) => {
      setIsProcessing(false);
      toast({
        title: "Error submitting Start of Day",
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
    submitMutation.mutate(formData);
  };

  const isAlreadySubmitted = !!todayReport;

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
                  <h1 className="mobile-heading font-semibold text-foreground">Start of Day Report</h1>
                  <p className="text-xs md:text-sm text-muted-foreground">Upload manifest and begin tracking</p>
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
                  {isAlreadySubmitted && (
                    <Badge variant="default" className="ml-2">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Submitted
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
                {isAlreadySubmitted ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="text-center p-4 rounded-lg bg-card/50">
                        <div className="text-lg font-bold text-gradient">
                          {todayReport.round_number}
                        </div>
                        <div className="text-sm text-muted-foreground">Selected Round</div>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-card/50">
                        <div className="text-lg font-bold text-gradient">
                          {todayReport.extracted_round_number || 'Processing...'}
                        </div>
                        <div className="text-sm text-muted-foreground">Detected Round</div>
                      </div>
                    </div>
                    
                    {todayReport.processing_status === 'completed' && (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div className="text-center p-3 rounded-lg bg-muted">
                          <div className="font-semibold">{todayReport.heavy_parcels || 0}</div>
                          <div className="text-xs text-muted-foreground">Heavy</div>
                        </div>
                        <div className="text-center p-3 rounded-lg bg-muted">
                          <div className="font-semibold">{todayReport.standard || 0}</div>
                          <div className="text-xs text-muted-foreground">Standard</div>
                        </div>
                        <div className="text-center p-3 rounded-lg bg-muted">
                          <div className="font-semibold">{todayReport.hanging_garments || 0}</div>
                          <div className="text-xs text-muted-foreground">Hanging</div>
                        </div>
                        <div className="text-center p-3 rounded-lg bg-muted">
                          <div className="font-semibold">{todayReport.packets || 0}</div>
                          <div className="text-xs text-muted-foreground">Packets</div>
                        </div>
                        <div className="text-center p-3 rounded-lg bg-muted">
                          <div className="font-semibold">{todayReport.small_packets || 0}</div>
                          <div className="text-xs text-muted-foreground">Small</div>
                        </div>
                        <div className="text-center p-3 rounded-lg bg-muted">
                          <div className="font-semibold">{todayReport.postables || 0}</div>
                          <div className="text-xs text-muted-foreground">Postables</div>
                        </div>
                      </div>
                    )}
                    
                    {todayReport.processing_status === 'processing' && (
                      <div className="text-center py-4">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">Processing your manifest...</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">Ready to submit your Start of Day report?</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Start of Day Form */}
            {!isAlreadySubmitted && (
              <Card className="logistics-card">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Package className="h-5 w-5 text-primary mr-2" />
                    Submit Start of Day Report
                  </CardTitle>
                  <CardDescription>
                    Upload your manifest screenshot for automatic processing
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Driver Name (Auto-filled) */}
                    <div className="space-y-2">
                      <Label>Driver Name</Label>
                      <Input 
                        value={`${profile?.first_name || ''} ${profile?.last_name || ''}`}
                        disabled
                        className="bg-muted"
                      />
                    </div>

                    {/* Round Number Selection */}
                    <div className="space-y-2">
                      <Label htmlFor="roundNumber">
                        Round Number <span className="text-destructive">*</span>
                      </Label>
                      <Select 
                        value={formData.roundNumber} 
                        onValueChange={(value) => {
                          setFormData(prev => ({ ...prev, roundNumber: value }));
                          if (errors.roundNumber) setErrors(prev => ({ ...prev, roundNumber: '' }));
                        }}
                      >
                        <SelectTrigger className={errors.roundNumber ? 'border-destructive' : ''}>
                          <SelectValue placeholder="Select your round for today" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableRounds?.map((round) => (
                            <SelectItem key={round.id} value={round.round_number}>
                              {round.round_number} - {round.description}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.roundNumber && (
                        <p className="text-sm text-destructive">{errors.roundNumber}</p>
                      )}
                    </div>

                    {/* Screenshot Upload */}
                    <div className="space-y-2">
                      <Label htmlFor="screenshot">
                        Manifest Screenshot <span className="text-destructive">*</span>
                      </Label>
                      <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
                        {previewUrl ? (
                          <div className="space-y-4">
                            <img 
                              src={previewUrl} 
                              alt="Preview" 
                              className="max-h-48 mx-auto rounded-lg"
                            />
                            <Button 
                              type="button" 
                              variant="outline" 
                              onClick={() => fileInputRef.current?.click()}
                            >
                              <Camera className="h-4 w-4 mr-2" />
                              Change Image
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <Upload className="h-12 w-12 text-muted-foreground mx-auto" />
                            <div>
                              <Button 
                                type="button" 
                                variant="outline" 
                                onClick={() => fileInputRef.current?.click()}
                              >
                                <Camera className="h-4 w-4 mr-2" />
                                Upload Screenshot
                              </Button>
                              <p className="text-sm text-muted-foreground mt-2">
                                PNG, JPG up to 10MB
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                      {errors.screenshot && (
                        <p className="text-sm text-destructive">{errors.screenshot}</p>
                      )}
                    </div>

                    {/* Submit Button */}
                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={submitMutation.isPending || isProcessing}
                    >
                      {submitMutation.isPending || isProcessing ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Package className="h-4 w-4 mr-2" />
                          Submit Start of Day Report
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* Success Dialog */}
            <AlertDialog open={showSuccess} onOpenChange={setShowSuccess}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center text-success">
                    <CheckCircle2 className="h-5 w-5 mr-2" />
                    Start of Day Submitted Successfully
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Your manifest has been uploaded and is being processed. Location tracking has started for your shift.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogAction onClick={() => navigate('/dashboard')}>
                    Go to Dashboard
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default StartOfDayEnhanced;