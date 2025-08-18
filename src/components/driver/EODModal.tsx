import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Upload, CheckCircle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';

interface EODModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface EndOfDayFormData {
  did_support: boolean;
  support_parcels: number;
  app_screenshot: File | null;
}

const EODModal: React.FC<EODModalProps> = ({ open, onOpenChange }) => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState<EndOfDayFormData>({
    did_support: false,
    support_parcels: 0,
    app_screenshot: null,
  });

  const [processing, setProcessing] = useState(false);

  const [isSubmitted, setIsSubmitted] = useState(false);

  // Fetch driver profile with assigned van and schedule info
  const { data: driverInfo, isLoading: loadingDriverInfo } = useQuery({
    queryKey: ['driver-eod-info', profile?.user_id],
    queryFn: async () => {
      if (!profile?.user_id) return null;

      // Get driver profile with van information
      const { data: driverProfile, error: driverError } = await supabase
        .from('driver_profiles')
        .select(`
          id,
          user_id,
          assigned_van_id,
          company_id,
          profiles!inner(first_name, last_name),
          vans(registration, make, model)
        `)
        .eq('user_id', profile.user_id)
        .single();

      if (driverError) throw driverError;

      // Get today's assigned rounds/schedule
      const today = new Date().toISOString().split('T')[0];
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
        assignedVan: driverProfile.vans,
        hasCompanyVan: !!driverProfile.assigned_van_id,
        roundNumbers: schedules?.map(s => s.rounds?.round_number).filter(Boolean) || []
      };
    },
    enabled: !!profile?.user_id && open,
  });

  const submitEODMutation = useMutation({
    mutationFn: async (data: EndOfDayFormData) => {
      if (!driverInfo?.driverProfile?.id) {
        throw new Error('Driver profile not found');
      }

      if (!data.app_screenshot) {
        throw new Error('Screenshot is required for processing');
      }

      setProcessing(true);

      // Upload screenshot
      const fileExt = data.app_screenshot.name.split('.').pop();
      const fileName = `${profile?.user_id}/eod-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('eod-screenshots')
        .upload(fileName, data.app_screenshot);

      if (uploadError) {
        throw new Error(`Failed to upload screenshot: ${uploadError.message}`);
      }

      // Insert EOD report with auto-filled data and processing status
      const { data: reportData, error: insertError } = await supabase
        .from('end_of_day_reports')
        .insert({
          driver_id: driverInfo.driverProfile.id,
          name: driverInfo.driverName,
          round_1_number: driverInfo.roundNumbers[0] || null,
          round_2_number: driverInfo.roundNumbers[1] || null,
          round_3_number: driverInfo.roundNumbers[2] || null,
          round_4_number: driverInfo.roundNumbers[3] || null,
          did_support: data.did_support,
          support_parcels: data.support_parcels,
          successful_deliveries: 0, // Will be updated by Vision API
          successful_collections: 0, // Will be updated by Vision API
          has_company_van: driverInfo.hasCompanyVan,
          van_registration: driverInfo.assignedVan?.registration || null,
          app_screenshot: fileName,
          processing_status: 'pending'
        })
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      // Call Vision API to process screenshot
      try {
        const { error: visionError } = await supabase.functions.invoke('eod-vision-ocr', {
          body: {
            screenshotPath: fileName,
            reportId: reportData.id
          }
        });

        if (visionError) {
          console.error('Vision API processing failed:', visionError);
        }
      } catch (visionApiError) {
        console.error('Vision API call failed:', visionApiError);
      }
    },
    onSuccess: () => {
      setProcessing(false);
      toast({
        title: "End of Day Report Submitted",
        description: "Your EOD report has been submitted and screenshot is being processed.",
      });
      setIsSubmitted(true);
      queryClient.invalidateQueries({ queryKey: ['eod-reports'] });
      queryClient.invalidateQueries({ queryKey: ['today-eod-report'] });
      
      // Close modal after a brief delay
      setTimeout(() => {
        onOpenChange(false);
        setIsSubmitted(false);
        // Reset form
        setFormData({
          did_support: false,
          support_parcels: 0,
          app_screenshot: null,
        });
      }, 2000);
    },
    onError: (error: any) => {
      setProcessing(false);
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
    if (!formData.app_screenshot) {
      toast({
        title: "Validation Error",
        description: "Please upload a screenshot of your delivery app.",
        variant: "destructive",
      });
      return;
    }

    if (formData.did_support && formData.support_parcels < 0) {
      toast({
        title: "Validation Error",
        description: "Support parcels cannot be negative.",
        variant: "destructive",
      });
      return;
    }

    submitEODMutation.mutate(formData);
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

      setFormData(prev => ({ ...prev, app_screenshot: file }));
    }
  };

  if (isSubmitted) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <div className="text-center py-6">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Report Submitted!</h2>
            <p className="text-muted-foreground">
              Your End of Day report has been submitted successfully.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>End of Day Report</DialogTitle>
          <DialogDescription>
            Complete your daily delivery report with performance metrics.
          </DialogDescription>
        </DialogHeader>

        {loadingDriverInfo ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading your information...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Auto-filled Information Display */}
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <h3 className="font-semibold text-sm">Auto-filled Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Driver:</span>
                  <span className="ml-2 font-medium">{driverInfo?.driverName}</span>
                </div>
                {driverInfo?.hasCompanyVan && driverInfo?.assignedVan && (
                  <div>
                    <span className="text-muted-foreground">Van:</span>
                    <span className="ml-2 font-medium">{driverInfo.assignedVan.registration}</span>
                  </div>
                )}
                {driverInfo?.roundNumbers && driverInfo.roundNumbers.length > 0 && (
                  <div className="md:col-span-2">
                    <span className="text-muted-foreground">Assigned Rounds:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {driverInfo.roundNumbers.map((round, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {round}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Support Work */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="support"
                  checked={formData.did_support}
                  onCheckedChange={(checked) => setFormData(prev => ({ 
                    ...prev, 
                    did_support: checked,
                    support_parcels: checked ? prev.support_parcels : 0
                  }))}
                />
                <Label htmlFor="support">Did you do any support work?</Label>
              </div>
              
              {formData.did_support && (
                <div className="space-y-2">
                  <Label htmlFor="supportParcels">Support Parcels</Label>
                  <Input
                    id="supportParcels"
                    type="number"
                    min="0"
                    value={formData.support_parcels}
                    onChange={(e) => setFormData(prev => ({ ...prev, support_parcels: parseInt(e.target.value) || 0 }))}
                    placeholder="Number of support parcels"
                  />
                </div>
              )}
            </div>

            {/* Processing Notice */}
            <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-start space-x-3">
                <Upload className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-900 dark:text-blue-100">Automatic Processing</h4>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    Upload a screenshot of your delivery app. Our system will automatically extract successful deliveries and collections from the image.
                  </p>
                </div>
              </div>
            </div>

            {/* Screenshot Upload */}
            <div className="space-y-2">
              <Label htmlFor="screenshot">App Screenshot *</Label>
              <div className="flex items-center space-x-2">
                <Input
                  id="screenshot"
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-sm file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                  required
                />
                <Upload className="h-4 w-4 text-muted-foreground" />
              </div>
              {formData.app_screenshot && (
                <p className="text-sm text-success">
                  ✓ Selected: {formData.app_screenshot.name}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Please upload a clear screenshot showing successful deliveries and collections from your delivery app.
              </p>
            </div>

            {/* Submit Button */}
            <div className="flex gap-3 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="flex-1"
                disabled={submitEODMutation.isPending || processing}
              >
                {submitEODMutation.isPending || processing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {processing ? 'Processing...' : 'Submitting...'}
                  </>
                ) : (
                  'Submit Report'
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default EODModal;