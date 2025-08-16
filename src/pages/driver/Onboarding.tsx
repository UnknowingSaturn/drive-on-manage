import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Upload, FileText, Car, Shield, AlertCircle, CheckCircle2, Clock, User, Phone } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { processSecureUpload, validateFileUpload } from '@/lib/secure-file-upload';

interface OnboardingFormData {
  firstName: string;
  lastName: string;
  phone: string;
  licenseNumber: string;
  licenseExpiry: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
  vehicleNotes: string;
}

interface UploadedDocuments {
  drivingLicense: boolean;
  rightToWork: boolean;
  insurance: boolean;
}

const DriverOnboarding = () => {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState<OnboardingFormData>({
    firstName: profile?.first_name || '',
    lastName: profile?.last_name || '',
    phone: profile?.phone || '',
    licenseNumber: '',
    licenseExpiry: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelation: '',
    vehicleNotes: ''
  });

  const [uploadedDocs, setUploadedDocs] = useState<UploadedDocuments>({
    drivingLicense: false,
    rightToWork: false,
    insurance: false
  });

  const [uploading, setUploading] = useState<string | null>(null);

  // Fetch current driver profile
  const { data: driverProfile, isLoading } = useQuery({
    queryKey: ['driver-profile-onboarding', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('driver_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user?.id
  });

  // Update uploaded docs status when driver profile changes
  React.useEffect(() => {
    if (driverProfile) {
      setUploadedDocs({
        drivingLicense: !!driverProfile.driving_license_document,
        rightToWork: !!driverProfile.right_to_work_document,
        insurance: !!driverProfile.insurance_document
      });
      
      // Pre-fill form data
      setFormData(prev => ({
        ...prev,
        licenseNumber: driverProfile.driving_license_number || '',
        licenseExpiry: driverProfile.license_expiry || ''
      }));
    }
  }, [driverProfile]);

  // Document upload handler
  const handleDocumentUpload = async (documentType: 'driving_license' | 'right_to_work' | 'insurance') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,application/pdf';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        setUploading(documentType);

        // Validate file
        const validation = validateFileUpload(file, 10485760, ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']);
        if (!validation.isValid) {
          throw new Error(validation.error);
        }

        toast({
          title: "Uploading document...",
          description: "Please wait while your document is being processed.",
        });

        // Upload using secure upload
        const result = await processSecureUpload(
          supabase,
          file,
          user!.id,
          'driver-documents',
          documentType
        );

        if (!result.success) {
          throw new Error(result.error);
        }

        // Update driver profile with document URL
        const { error: updateError } = await supabase
          .from('driver_profiles')
          .update({
            [`${documentType}_document`]: result.data.path
          })
          .eq('user_id', user!.id);

        if (updateError) throw updateError;

        // Update uploaded docs state
        const docKey = documentType === 'driving_license' ? 'drivingLicense' :
                      documentType === 'right_to_work' ? 'rightToWork' : 'insurance';
        setUploadedDocs(prev => ({ ...prev, [docKey]: true }));

        toast({
          title: "Document uploaded successfully",
          description: "Your document has been securely uploaded and verified.",
        });

        queryClient.invalidateQueries({ queryKey: ['driver-profile-onboarding'] });

      } catch (error: any) {
        toast({
          title: "Upload failed",
          description: error.message || "Failed to upload document.",
          variant: "destructive",
        });
      } finally {
        setUploading(null);
      }
    };
    input.click();
  };

  // Complete onboarding mutation
  const completeOnboardingMutation = useMutation({
    mutationFn: async (data: OnboardingFormData) => {
      // Update profile first
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          first_name: data.firstName,
          last_name: data.lastName,
          phone: data.phone
        })
        .eq('user_id', user?.id);

      if (profileError) throw profileError;

      // Update driver profile
      const { error: driverError } = await supabase
        .from('driver_profiles')
        .update({
          driving_license_number: data.licenseNumber,
          license_expiry: data.licenseExpiry,
          emergency_contact_name: data.emergencyContactName || null,
          emergency_contact_phone: data.emergencyContactPhone || null,
          emergency_contact_relation: data.emergencyContactRelation || null,
          vehicle_notes: data.vehicleNotes || null,
          first_login_completed: true,
          onboarding_completed_at: new Date().toISOString(),
          requires_onboarding: false,
          status: 'active'
        })
        .eq('user_id', user!.id);

      if (driverError) throw driverError;
    },
    onSuccess: () => {
      toast({
        title: "Onboarding completed!",
        description: "Welcome to the driver portal. You can now access all features.",
      });
      
      // Invalidate both queries to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ['driver-profile-onboarding'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      
      // Refresh the auth profile
      refreshProfile().then(() => {
        navigate('/dashboard');
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error completing onboarding",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.firstName || !formData.lastName || !formData.phone || 
        !formData.licenseNumber || !formData.licenseExpiry) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    // Validate documents (insurance is optional)
    if (!uploadedDocs.drivingLicense || !uploadedDocs.rightToWork) {
      toast({
        title: "Missing documents",
        description: "Please upload driving license and right to work documents before completing onboarding.",
        variant: "destructive",
      });
      return;
    }

    completeOnboardingMutation.mutate(formData);
  };

  // Calculate progress (insurance is optional)
  const getProgress = () => {
    let completed = 0;
    const total = 7; // Changed from 8 to 7 since insurance is optional

    if (formData.firstName) completed++;
    if (formData.lastName) completed++;
    if (formData.phone) completed++;
    if (formData.licenseNumber) completed++;
    if (formData.licenseExpiry) completed++;
    if (uploadedDocs.drivingLicense) completed++;
    if (uploadedDocs.rightToWork) completed++;
    // Insurance is optional, so don't count it for completion

    return Math.round((completed / total) * 100);
  };

  const progress = getProgress();
  const isComplete = progress === 100;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading onboarding...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Driver Onboarding</h1>
          <p className="text-muted-foreground">Complete your profile to access the driver portal</p>
        </div>

        {/* Progress */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Onboarding Progress</span>
              <Badge variant={isComplete ? "default" : "secondary"}>
                {progress}% Complete
              </Badge>
            </div>
            <Progress value={progress} className="mb-4" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <div className="flex items-center space-x-1">
                {formData.firstName && formData.lastName ? (
                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                ) : (
                  <Clock className="h-3 w-3 text-muted-foreground" />
                )}
                <span>Personal Info</span>
              </div>
              <div className="flex items-center space-x-1">
                {formData.licenseNumber && formData.licenseExpiry ? (
                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                ) : (
                  <Clock className="h-3 w-3 text-muted-foreground" />
                )}
                <span>License Details</span>
              </div>
              <div className="flex items-center space-x-1">
                {uploadedDocs.drivingLicense && uploadedDocs.rightToWork ? (
                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                ) : (
                  <Clock className="h-3 w-3 text-muted-foreground" />
                )}
                <span>Documents</span>
              </div>
              <div className="flex items-center space-x-1">
                {formData.phone ? (
                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                ) : (
                  <Clock className="h-3 w-3 text-muted-foreground" />
                )}
                <span>Contact Info</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Personal Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <User className="h-5 w-5 text-primary mr-2" />
                Personal Information
              </CardTitle>
              <CardDescription>
                Basic information for your driver profile
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                    placeholder="Enter your first name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                    placeholder="Enter your last name"
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number *</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="Enter your phone number"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  value={profile?.email || ''}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">Email cannot be changed</p>
              </div>
            </CardContent>
          </Card>

          {/* Driving License */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Car className="h-5 w-5 text-primary mr-2" />
                Driving License Information
              </CardTitle>
              <CardDescription>
                Your license details and document upload
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="licenseNumber">License Number *</Label>
                  <Input
                    id="licenseNumber"
                    value={formData.licenseNumber}
                    onChange={(e) => setFormData(prev => ({ ...prev, licenseNumber: e.target.value }))}
                    placeholder="Enter license number"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="licenseExpiry">Expiry Date *</Label>
                  <Input
                    id="licenseExpiry"
                    type="date"
                    value={formData.licenseExpiry}
                    onChange={(e) => setFormData(prev => ({ ...prev, licenseExpiry: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="border-2 border-dashed border-muted rounded-lg p-6">
                <div className="text-center">
                  <Car className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm font-medium mb-1">
                    {uploadedDocs.drivingLicense ? 'Driving License Uploaded' : 'Upload Driving License *'}
                  </p>
                  <p className="text-xs text-muted-foreground mb-3">
                    PDF, JPEG, or PNG format (max 10MB)
                  </p>
                  <Button 
                    type="button"
                    variant="outline" 
                    size="sm"
                    onClick={() => handleDocumentUpload('driving_license')}
                    disabled={uploading === 'driving_license'}
                  >
                    {uploading === 'driving_license' ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
                        Uploading...
                      </>
                    ) : uploadedDocs.drivingLicense ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />
                        Replace Document
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload License
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Required Documents */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="h-5 w-5 text-primary mr-2" />
                Required Documents
              </CardTitle>
              <CardDescription>
                Upload your right to work document (insurance optional)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Right to Work */}
              <div className="border-2 border-dashed border-muted rounded-lg p-6">
                <div className="text-center">
                  <Shield className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm font-medium mb-1">
                    {uploadedDocs.rightToWork ? 'Right to Work Document Uploaded' : 'Upload Right to Work Document *'}
                  </p>
                  <p className="text-xs text-muted-foreground mb-3">
                    Passport, Visa, or other work authorization document
                  </p>
                  <Button 
                    type="button"
                    variant="outline" 
                    size="sm"
                    onClick={() => handleDocumentUpload('right_to_work')}
                    disabled={uploading === 'right_to_work'}
                  >
                    {uploading === 'right_to_work' ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
                        Uploading...
                      </>
                    ) : uploadedDocs.rightToWork ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />
                        Replace Document
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Document
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Insurance */}
              <div className="border-2 border-dashed border-muted rounded-lg p-6">
                <div className="text-center">
                  <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm font-medium mb-1">
                    {uploadedDocs.insurance ? 'Insurance Document Uploaded' : 'Upload Insurance Document (Optional)'}
                  </p>
                  <p className="text-xs text-muted-foreground mb-3">
                    Valid driving insurance certificate (optional)
                  </p>
                  <Button 
                    type="button"
                    variant="outline" 
                    size="sm"
                    onClick={() => handleDocumentUpload('insurance')}
                    disabled={uploading === 'insurance'}
                  >
                    {uploading === 'insurance' ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
                        Uploading...
                      </>
                    ) : uploadedDocs.insurance ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />
                        Replace Document
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Document
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Emergency Contact */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Phone className="h-5 w-5 text-primary mr-2" />
                Emergency Contact (Optional)
              </CardTitle>
              <CardDescription>
                Emergency contact information for safety purposes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="emergencyContactName">Contact Name</Label>
                  <Input
                    id="emergencyContactName"
                    value={formData.emergencyContactName}
                    onChange={(e) => setFormData(prev => ({ ...prev, emergencyContactName: e.target.value }))}
                    placeholder="Full name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emergencyContactPhone">Contact Phone</Label>
                  <Input
                    id="emergencyContactPhone"
                    type="tel"
                    value={formData.emergencyContactPhone}
                    onChange={(e) => setFormData(prev => ({ ...prev, emergencyContactPhone: e.target.value }))}
                    placeholder="Phone number"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="emergencyContactRelation">Relationship</Label>
                <Input
                  id="emergencyContactRelation"
                  value={formData.emergencyContactRelation}
                  onChange={(e) => setFormData(prev => ({ ...prev, emergencyContactRelation: e.target.value }))}
                  placeholder="e.g., Spouse, Parent, Sibling"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vehicleNotes">Vehicle/Route Notes</Label>
                <Textarea
                  id="vehicleNotes"
                  value={formData.vehicleNotes}
                  onChange={(e) => setFormData(prev => ({ ...prev, vehicleNotes: e.target.value }))}
                  placeholder="Any special notes about vehicle preferences or accessibility requirements"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Submit */}
          <Card>
            <CardContent className="pt-6">
              {!isComplete && (
                <div className="mb-4 p-4 bg-muted rounded-lg">
                  <div className="flex items-center space-x-2 text-amber-700">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">Complete all required sections to finish onboarding</span>
                  </div>
                </div>
              )}
              
              <Button 
                type="submit"
                className="w-full"
                disabled={!isComplete || completeOnboardingMutation.isPending}
                size="lg"
              >
                {completeOnboardingMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Completing Onboarding...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Complete Onboarding
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </form>
      </div>
    </div>
  );
};

export default DriverOnboarding;