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

const StartOfDayEnhanced = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    roundNumber: '',
    screenshot: null as File | null
  });

  const [isSubmitted, setIsSubmitted] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  // Get driver profile and info
  const { data: driverInfo, isLoading: loadingDriverInfo } = useQuery({
    queryKey: ['driver-sod-info', user?.id, profile?.user_id],
    queryFn: async () => {
      // Try both user.id and profile.user_id for compatibility
      const userId = user?.id || profile?.user_id;
      if (!userId) return null;

      console.log('StartOfDayEnhanced: Fetching driver profile for user:', userId);

      // Get driver profile
      const { data: driverProfile, error: driverError } = await supabase
        .from('driver_profiles')
        .select(`
          id,
          user_id,
          company_id,
          profiles!inner(first_name, last_name)
        `)
        .eq('user_id', userId)
        .maybeSingle();

      if (driverError) {
        console.error('StartOfDayEnhanced: Error fetching driver profile:', driverError);
        throw driverError;
      }
      
      if (!driverProfile) {
        console.log('StartOfDayEnhanced: No driver profile found for user:', userId);
        return null;
      }

      console.log('StartOfDayEnhanced: Driver profile found:', driverProfile);

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
    enabled: !!(user?.id || profile?.user_id),
  });

  // Check if already submitted today - allow multiple submissions for different rounds
  const { data: todayReports } = useQuery({
    queryKey: ['today-sod-reports', driverInfo?.driverProfile?.id, today],
    queryFn: async () => {
      if (!driverInfo?.driverProfile?.id) return [];
      const { data } = await supabase
        .from('start_of_day_reports')
        .select('*')
        .eq('driver_id', driverInfo.driverProfile.id)
        .gte('created_at', `${today}T00:00:00Z`)
        .lt('created_at', `${today}T23:59:59Z`)
        .order('created_at', { ascending: false });
      return data || [];
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
            driver_name: driverInfo.driverName,
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

        // Start location tracking is removed
        // Location tracking functionality has been removed

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
        description: "Your SOD report has been submitted and is being processed.",
      });
      setIsSubmitted(true);
      queryClient.invalidateQueries({ queryKey: ['today-sod-reports'] });
      queryClient.invalidateQueries({ queryKey: ['sod-reports'] });
      
      // Reset form for next submission
      setTimeout(() => {
        setIsSubmitted(false);
        setFormData({
          roundNumber: '',
          screenshot: null
        });
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }, 3000);
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
              {/* Show previous submissions for today if any */}
              {todayReports && todayReports.length > 0 && (
                <Card className="logistics-card mb-6">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center text-lg">
                      <Package className="h-5 w-5 text-primary mr-2" />
                      Today's Submissions
                    </CardTitle>
                    <CardDescription className="text-sm">
                      {todayReports.length} report{todayReports.length !== 1 ? 's' : ''} submitted today
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-3">
                      {todayReports.map((report, index) => (
                        <div key={report.id} className="flex items-center justify-between p-3 rounded-lg bg-card/50 border">
                          <div className="flex items-center space-x-4">
                            <div className="text-sm">
                              <div className="font-medium">Round {report.round_number}</div>
                              {report.extracted_round_number && (
                                <div className="text-muted-foreground">
                                  Detected: {report.extracted_round_number}
                                </div>
                              )}
                            </div>
                            <Badge variant={
                              report.processing_status === 'completed' ? 'default' :
                              report.processing_status === 'processing' ? 'secondary' :
                              report.processing_status === 'failed' ? 'destructive' : 'outline'
                            }>
                              {report.processing_status === 'completed' ? 'Processed' :
                               report.processing_status === 'processing' ? 'Processing...' :
                               report.processing_status === 'failed' ? 'Failed' : 'Pending'}
                            </Badge>
                          </div>
                           <div className="text-xs text-muted-foreground">
                             {new Date(report.created_at).toLocaleTimeString()}
                           </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Main form - always show to allow multiple submissions */}
              <Card className="logistics-card">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center text-lg">
                    <Package className="h-5 w-5 text-primary mr-2" />
                    Submit Round Report
                  </CardTitle>
                  <CardDescription className="text-sm">
                    Upload manifest screenshot for processing. You can submit multiple rounds throughout the day.
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
                            <SelectValue placeholder="Select round for this submission" />
                          </SelectTrigger>
                          <SelectContent>
                            {driverInfo?.roundNumbers?.map((round, index) => (
                              <SelectItem key={index} value={round}>
                                Round {round}
                              </SelectItem>
                            ))}
                            {/* Allow custom round input */}
                            <SelectItem value="custom">Other Round</SelectItem>
                          </SelectContent>
                        </Select>
                        {formData.roundNumber === 'custom' && (
                          <Input
                            placeholder="Enter round number"
                            value={formData.roundNumber === 'custom' ? '' : formData.roundNumber}
                            onChange={(e) => setFormData(prev => ({ ...prev, roundNumber: e.target.value }))}
                          />
                        )}
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
                              Processing...
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
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default StartOfDayEnhanced;