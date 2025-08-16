import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Upload, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';

interface EndOfDayFormData {
  name: string;
  round_1_number: string;
  round_2_number: string;
  round_3_number: string;
  round_4_number: string;
  did_support: boolean;
  support_parcels: number;
  successful_deliveries: number;
  successful_collections: number;
  has_company_van: boolean;
  van_registration: string;
  round_start_time: Date | null;
  round_end_time: Date | null;
  app_screenshot: File | null;
}

const NewEndOfDay = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState<EndOfDayFormData>({
    name: '',
    round_1_number: '',
    round_2_number: '',
    round_3_number: '',
    round_4_number: '',
    did_support: false,
    support_parcels: 0,
    successful_deliveries: 0,
    successful_collections: 0,
    has_company_van: false,
    van_registration: '',
    round_start_time: null,
    round_end_time: null,
    app_screenshot: null,
  });

  const [driverProfile, setDriverProfile] = useState<any>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Fetch driver profile to get driver name
  useEffect(() => {
    const fetchDriverProfile = async () => {
      if (!profile?.user_id) return;

      const { data, error } = await supabase
        .from('driver_profiles')
        .select(`
          id,
          user_id,
          profiles!inner(first_name, last_name)
        `)
        .eq('user_id', profile.user_id)
        .single();

      if (data && !error) {
        setDriverProfile(data);
        // Pre-fill name from driver profile
        setFormData(prev => ({
          ...prev,
          name: `${data.profiles.first_name} ${data.profiles.last_name}`.trim()
        }));
      }
    };

    fetchDriverProfile();
  }, [profile?.user_id]);

  const submitEODMutation = useMutation({
    mutationFn: async (data: EndOfDayFormData) => {
      if (!driverProfile?.id) {
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

      // Insert EOD report
      const { error } = await supabase
        .from('end_of_day_reports')
        .insert({
          driver_id: driverProfile.id,
          name: data.name,
          round_1_number: data.round_1_number || null,
          round_2_number: data.round_2_number || null,
          round_3_number: data.round_3_number || null,
          round_4_number: data.round_4_number || null,
          did_support: data.did_support,
          support_parcels: data.support_parcels,
          successful_deliveries: data.successful_deliveries,
          successful_collections: data.successful_collections,
          has_company_van: data.has_company_van,
          van_registration: data.has_company_van ? data.van_registration : null,
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
    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Driver name is required.",
        variant: "destructive",
      });
      return;
    }

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

    if (formData.has_company_van && !formData.van_registration.trim()) {
      toast({
        title: "Validation Error",
        description: "Van registration is required when using a company van.",
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
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <div className="flex h-16 items-center gap-2 px-4 border-b">
            <SidebarTrigger />
            <h1 className="text-2xl font-semibold">End of Day Report</h1>
          </div>
          <div className="container mx-auto py-8">
            <Card className="max-w-md mx-auto text-center">
              <CardContent className="pt-6">
                <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2">Report Submitted!</h2>
                <p className="text-muted-foreground mb-4">
                  Your End of Day report has been submitted successfully.
                </p>
                <Button onClick={() => setIsSubmitted(false)}>
                  Submit Another Report
                </Button>
              </CardContent>
            </Card>
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <div className="flex h-16 items-center gap-2 px-4 border-b">
          <SidebarTrigger />
          <h1 className="text-2xl font-semibold">End of Day Report</h1>
        </div>
        <div className="container mx-auto py-8">
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>End of Day Report</CardTitle>
              <CardDescription>
                Submit your daily delivery report with round details and performance metrics.
              </CardDescription>
            </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Driver Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Driver Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter driver name"
                required
              />
            </div>

            {/* Round Numbers */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="round1">Round 1 Number</Label>
                <Input
                  id="round1"
                  value={formData.round_1_number}
                  onChange={(e) => setFormData(prev => ({ ...prev, round_1_number: e.target.value }))}
                  placeholder="Round 1"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="round2">Round 2 Number</Label>
                <Input
                  id="round2"
                  value={formData.round_2_number}
                  onChange={(e) => setFormData(prev => ({ ...prev, round_2_number: e.target.value }))}
                  placeholder="Round 2"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="round3">Round 3 Number</Label>
                <Input
                  id="round3"
                  value={formData.round_3_number}
                  onChange={(e) => setFormData(prev => ({ ...prev, round_3_number: e.target.value }))}
                  placeholder="Round 3"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="round4">Round 4 Number</Label>
                <Input
                  id="round4"
                  value={formData.round_4_number}
                  onChange={(e) => setFormData(prev => ({ ...prev, round_4_number: e.target.value }))}
                  placeholder="Round 4"
                />
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

            {/* Company Van */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="companyVan"
                  checked={formData.has_company_van}
                  onCheckedChange={(checked) => setFormData(prev => ({ 
                    ...prev, 
                    has_company_van: checked,
                    van_registration: checked ? prev.van_registration : ''
                  }))}
                />
                <Label htmlFor="companyVan">Do you have a company van?</Label>
              </div>
              
              {formData.has_company_van && (
                <div className="space-y-2">
                  <Label htmlFor="vanReg">Van Registration *</Label>
                  <Input
                    id="vanReg"
                    value={formData.van_registration}
                    onChange={(e) => setFormData(prev => ({ ...prev, van_registration: e.target.value }))}
                    placeholder="Van registration number"
                    required={formData.has_company_van}
                  />
                </div>
              )}
            </div>

            {/* Round Timings */}
            <div className="grid grid-cols-2 gap-4">
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
            <Button 
              type="submit" 
              className="w-full" 
              disabled={submitEODMutation.isPending}
            >
              {submitEODMutation.isPending ? 'Submitting...' : 'Submit End of Day Report'}
            </Button>
          </form>
        </CardContent>
      </Card>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default NewEndOfDay;