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
  successful_deliveries: number;
  successful_collections: number;
  round_start_time: Date | null;
  round_end_time: Date | null;
  app_screenshot: File | null;
}

const EODModal: React.FC<EODModalProps> = ({ open, onOpenChange }) => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState<EndOfDayFormData>({
    did_support: false,
    support_parcels: 0,
    successful_deliveries: 0,
    successful_collections: 0,
    round_start_time: null,
    round_end_time: null,
    app_screenshot: null,
  });

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

      let screenshotUrl = null;

      // Upload screenshot if provided
      if (data.app_screenshot) {
        const fileExt = data.app_screenshot.name.split('.').pop();
        const fileName = `${profile?.user_id}/eod-${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('eod-screenshots')
          .upload(fileName, data.app_screenshot);

        if (uploadError) {
          throw new Error(`Failed to upload screenshot: ${uploadError.message}`);
        }

        screenshotUrl = fileName;
      }

      // Insert EOD report with auto-filled data
      const { error } = await supabase
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
          successful_deliveries: data.successful_deliveries,
          successful_collections: data.successful_collections,
          has_company_van: driverInfo.hasCompanyVan,
          van_registration: driverInfo.assignedVan?.registration || null,
          round_start_time: data.round_start_time?.toISOString(),
          round_end_time: data.round_end_time?.toISOString(),
          app_screenshot: screenshotUrl,
        });

      if (error) {
        throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: "End of Day Report Submitted",
        description: "Your EOD report has been submitted successfully.",
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
          successful_deliveries: 0,
          successful_collections: 0,
          round_start_time: null,
          round_end_time: null,
          app_screenshot: null,
        });
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
    if (formData.successful_deliveries < 0 || formData.successful_collections < 0) {
      toast({
        title: "Validation Error",
        description: "Deliveries and collections cannot be negative.",
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

            {/* Deliveries and Collections */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="deliveries">Successful Deliveries *</Label>
                <Input
                  id="deliveries"
                  type="number"
                  min="0"
                  value={formData.successful_deliveries}
                  onChange={(e) => setFormData(prev => ({ ...prev, successful_deliveries: parseInt(e.target.value) || 0 }))}
                  placeholder="Number of deliveries"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="collections">Successful Collections *</Label>
                <Input
                  id="collections"
                  type="number"
                  min="0"
                  value={formData.successful_collections}
                  onChange={(e) => setFormData(prev => ({ ...prev, successful_collections: parseInt(e.target.value) || 0 }))}
                  placeholder="Number of collections"
                  required
                />
              </div>
            </div>

            {/* Round Timings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Round Start Time</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formData.round_start_time && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.round_start_time ? format(formData.round_start_time, "PPP p") : "Pick start time"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.round_start_time || undefined}
                      onSelect={(date) => setFormData(prev => ({ ...prev, round_start_time: date || null }))}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Round End Time</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formData.round_end_time && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.round_end_time ? format(formData.round_end_time, "PPP p") : "Pick end time"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.round_end_time || undefined}
                      onSelect={(date) => setFormData(prev => ({ ...prev, round_end_time: date || null }))}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Screenshot Upload */}
            <div className="space-y-2">
              <Label htmlFor="screenshot">App Screenshot</Label>
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
              {formData.app_screenshot && (
                <p className="text-sm text-muted-foreground">
                  Selected: {formData.app_screenshot.name}
                </p>
              )}
            </div>

            {/* Total Parcels Display */}
            <div className="bg-muted p-4 rounded-lg">
              <Label className="text-sm font-medium">Total Parcels (Calculated)</Label>
              <p className="text-2xl font-bold">
                {formData.successful_deliveries + formData.successful_collections + formData.support_parcels}
              </p>
              <p className="text-xs text-muted-foreground">
                Deliveries ({formData.successful_deliveries}) + Collections ({formData.successful_collections}) + Support ({formData.support_parcels})
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
                disabled={submitEODMutation.isPending}
              >
                {submitEODMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
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