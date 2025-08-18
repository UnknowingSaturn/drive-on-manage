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
import { Package, Upload, Camera, CheckCircle, Loader2 } from 'lucide-react';
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

  const [isSubmitted, setIsSubmitted] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  // Get driver profile and info
  const { data: driverInfo, isLoading: loadingDriverInfo } = useQuery({
    queryKey: ['driver-sod-info', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      // Get driver profile
      const { data: driverProfile, error: driverError } = await supabase
        .from('driver_profiles')
        .select(`
          id,
          user_id,
          company_id,
          profiles!inner(first_name, last_name)
        `)
        .eq('user_id', user.id)
        .single();

      if (driverError) throw driverError;

      // Get today's assigned rounds/schedule
      const { data: schedules, error: scheduleError } = await supabase
        .from('schedules')
        .select(`
          *,
          rounds(round_number, description)
        `)
        .eq('driver_id', driverProfile.id)
        .eq('scheduled_date', today);

      if (scheduleError) throw scheduleError;

      return {
        driverProfile,
        schedules: schedules || [],
        driverName: `${driverProfile.profiles.first_name} ${driverProfile.profiles.last_name}`.trim(),
        roundNumbers: schedules?.map(s => s.rounds?.round_number).filter(Boolean) || []
      };
    },
    enabled: !!user?.id,
  });

  // Check if already submitted today
  const { data: todayReport } = useQuery({
    queryKey: ['today-sod-report', driverInfo?.driverProfile?.id, today],
    queryFn: async () => {
      if (!driverInfo?.driverProfile?.id) return null;
      const { data } = await supabase
        .from('start_of_day_reports')
        .select('*')
        .eq('driver_id', driverInfo.driverProfile.id)
        .gte('submitted_at', `${today}T00:00:00Z`)
        .lt('submitted_at', `${today}T23:59:59Z`)
        .maybeSingle();
      return data;
    },
    enabled: !!driverInfo?.driverProfile?.id
  });

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

  // Start of day submission mutation
  const submitMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!driverInfo?.driverProfile?.id || !data.screenshot) {
        throw new Error('Missing required data');
      }

      let screenshotUrl = null;
      let reportId = null;

      try {
        // Upload screenshot if provided
        if (data.screenshot) {
          const fileExt = data.screenshot.name.split('.').pop();
          const fileName = `${user?.id}/sod-${Date.now()}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from('sod-screenshots')
            .upload(fileName, data.screenshot);

          if (uploadError) {
            throw new Error(`Failed to upload screenshot: ${uploadError.message}`);
          }

          screenshotUrl = fileName;
        }

        // Insert SOD report with initial data
        const { data: reportData, error: insertError } = await supabase
          .from('start_of_day_reports')
          .insert({
            driver_id: driverInfo.driverProfile.id,
            company_id: driverInfo.driverProfile.company_id,
            name: driverInfo.driverName,
            round_number: data.roundNumber,
            screenshot_url: screenshotUrl,
            processing_status: 'processing'
          })
          .select()
          .single();

        if (insertError) {
          // If DB insert fails, clean up uploaded file
          if (screenshotUrl) {
            try {
              await supabase.storage
                .from('sod-screenshots')
                .remove([screenshotUrl]);
            } catch (cleanupError) {
              console.error('Failed to cleanup file after DB error:', cleanupError);
            }
          }
          throw insertError;
        }

        reportId = reportData.id;

        // Process with Vision OCR if screenshot was uploaded
        if (screenshotUrl) {
          try {
            const { error: visionError } = await supabase.functions.invoke('vision-ocr', {
              body: { 
                screenshotPath: screenshotUrl,
                reportId: reportId
              }
            });

            if (visionError) {
              console.error('Vision processing error:', visionError);
              // Don't fail the submission if Vision fails, just log it
            }
          } catch (visionError) {
            console.error('Failed to invoke vision processing:', visionError);
            // Don't fail the submission if Vision fails
          }
        }

        // Start location tracking
        try {
          await startShift();
        } catch (trackingError) {
          console.error('Failed to start location tracking:', trackingError);
          // Don't fail the submission if tracking fails
        }

        return reportData;

      } catch (error) {
        // If anything fails after file upload, clean up
        if (screenshotUrl) {
          try {
            await supabase.storage
              .from('sod-screenshots')
              .remove([screenshotUrl]);
          } catch (cleanupError) {
            console.error('Failed to cleanup file after error:', cleanupError);
          }
        }
        throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: "Start of Day Report Submitted",
        description: "Your SOD report has been submitted successfully.",
      });
      setIsSubmitted(true);
      queryClient.invalidateQueries({ queryKey: ['today-sod-report'] });
      queryClient.invalidateQueries({ queryKey: ['sod-reports'] });
      
      // Navigate back to dashboard after brief delay
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    },
    onError: (error: any) => {
      toast({
        title: "Submission Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.roundNumber) {
      toast({
        title: "Validation Error",
        description: "Please select a round number.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.screenshot) {
      toast({
        title: "Validation Error",
        description: "Please upload a manifest screenshot.",
        variant: "destructive",
      });
      return;
    }

    submitMutation.mutate(formData);
  };

  if (loadingDriverInfo) {
    return (
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-background">
          <AppSidebar />
          <SidebarInset className="flex-1">
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                <p>Loading...</p>
              </div>
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    );
  }

  if (isSubmitted) {
    return (
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-background">
          <AppSidebar />
          <SidebarInset className="flex-1">
            <div className="flex items-center justify-center h-full">
              <div className="text-center py-6">
                <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2">Report Submitted!</h2>
                <p className="text-muted-foreground">
                  Your Start of Day report has been submitted successfully.
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Redirecting to dashboard...
                </p>
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
                  <p className="text-xs md:text-sm text-muted-foreground">Submit your manifest and begin shift</p>
                </div>
              </div>
            </div>
          </header>

          <main className="mobile-padding py-4 md:py-6 space-y-4 md:space-y-6 no-overflow overflow-y-auto">
            <div className="max-w-3xl mx-auto">
              {/* If already completed today */}
              {todayReport ? (
                <Card className="logistics-card">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center text-lg">
                      <Package className="h-5 w-5 text-primary mr-2" />
                      Start of Day Summary
                      <Badge variant="default" className="ml-2">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Completed
                      </Badge>
                    </CardTitle>
                    <CardDescription className="text-sm">
                      {new Date().toLocaleDateString('en-GB', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="text-center p-4 rounded-lg bg-card/50">
                        <div className="text-2xl font-bold text-gradient">
                          {todayReport.round_number}
                        </div>
                        <div className="text-sm text-muted-foreground">Selected Round</div>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-card/50">
                        <div className="text-2xl font-bold text-gradient">
                          {todayReport.extracted_round_number || 'Processing...'}
                        </div>
                        <div className="text-sm text-muted-foreground">Detected Round</div>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-card/50">
                        <div className="text-sm text-success">
                          Completed at {new Date(todayReport.submitted_at).toLocaleTimeString()}
                        </div>
                        <div className="text-sm text-muted-foreground">Time</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="logistics-card">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center text-lg">
                      <Package className="h-5 w-5 text-primary mr-2" />
                      Start of Day Report
                    </CardTitle>
                    <CardDescription className="text-sm">
                      Upload your manifest screenshot to begin your shift.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <form onSubmit={handleSubmit} className="space-y-6">
                      {/* Auto-filled Information Display */}
                      <div className="bg-muted p-3 rounded-lg space-y-2">
                        <h3 className="font-semibold text-sm">Auto-filled Information</h3>
                        <div className="text-sm">
                          <span className="text-muted-foreground">Driver:</span>
                          <span className="ml-2 font-medium">{driverInfo?.driverName}</span>
                        </div>
                      </div>

                      {/* Round Number Selection */}
                      <div className="space-y-2">
                        <Label htmlFor="roundNumber">
                          Round Number <span className="text-destructive">*</span>
                        </Label>
                        <Select 
                          value={formData.roundNumber} 
                          onValueChange={(value) => setFormData(prev => ({ ...prev, roundNumber: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select your round for today" />
                          </SelectTrigger>
                          <SelectContent>
                            {driverInfo?.roundNumbers?.map((round, index) => (
                              <SelectItem key={index} value={round}>
                                {round}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Screenshot Upload */}
                      <div className="space-y-2">
                        <Label htmlFor="screenshot">
                          Manifest Screenshot <span className="text-destructive">*</span>
                        </Label>
                        <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
                          {formData.screenshot ? (
                            <div className="space-y-4">
                              <div className="text-sm text-muted-foreground">
                                File selected: {formData.screenshot.name}
                              </div>
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
                                  PNG, JPG up to 5MB
                                </p>
                              </div>
                            </div>
                          )}
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            className="hidden"
                          />
                        </div>
                      </div>

                      {/* Submit Button */}
                      <div className="flex gap-4 pt-4">
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => navigate('/dashboard')} 
                          className="flex-1"
                        >
                          Cancel
                        </Button>
                        <Button 
                          type="submit" 
                          disabled={submitMutation.isPending}
                          className="flex-1"
                        >
                          {submitMutation.isPending ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Submitting...
                            </>
                          ) : (
                            <>
                              <Upload className="h-4 w-4 mr-2" />
                              Submit Report
                            </>
                          )}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              )}
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default StartOfDayEnhanced;