import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileText, CheckCircle, AlertCircle, User, Lock, Shield, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface InvitationData {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  parcel_rate?: number;
  hourly_rate?: number; // Keep for backward compatibility
  company_id: string;
  status: string;
  expires_at: string;
}

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  required: boolean;
}

const DriverOnboarding = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    // Personal Info
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    dateOfBirth: '',
    emergencyContact: '',
    emergencyPhone: '',
    
    // Account Setup
    password: '',
    confirmPassword: '',
    
    // Documents
    licenseNumber: '',
    licenseExpiry: '',
    
    // Terms
    acceptTerms: false,
    acceptPrivacy: false,
  });

  const [uploadedFiles, setUploadedFiles] = useState({
    license: null as File | null,
    insurance: null as File | null,
    rightToWork: null as File | null,
    avatar: null as File | null,
  });

  const [uploadProgress, setUploadProgress] = useState({
    license: 0,
    insurance: 0,
    rightToWork: 0,
    avatar: 0,
  });

  const steps: OnboardingStep[] = [
    {
      id: 'personal',
      title: 'Personal Information',
      description: 'Complete your profile details',
      completed: false,
      required: true,
    },
    {
      id: 'account',
      title: 'Account Security',
      description: 'Set up your secure password',
      completed: false,
      required: true,
    },
    {
      id: 'documents',
      title: 'Upload Documents',
      description: 'Upload required documents',
      completed: false,
      required: true,
    },
    {
      id: 'terms',
      title: 'Terms & Conditions',
      description: 'Accept terms and privacy policy',
      completed: false,
      required: true,
    },
  ];

  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      toast({
        title: "Access Denied",
        description: "Driver onboarding requires a valid invitation link from your company.",
        variant: "destructive"
      });
      navigate('/not-authorized');
      return;
    }
    
    fetchInvitation();
  }, [token]);

  const fetchInvitation = async () => {
    try {
      setLoading(true);
      
      console.log('Looking for invitation with token:', token);
      
      const { data: inviteData, error } = await supabase
        .from('driver_invitations')
        .select('*')
        .eq('invite_token', token)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .maybeSingle();

      console.log('Invitation query result:', { inviteData, error });

      if (error) {
        console.error('Database error:', error);
        throw new Error('Database error: ' + error.message);
      }

      if (!inviteData) {
        console.log('No invitation found with token:', token);
        // Try to find any invitation with this token to debug
        const { data: anyInvite } = await supabase
          .from('driver_invitations')
          .select('*')
          .eq('invite_token', token);
        console.log('Any invitations with this token:', anyInvite);
        throw new Error('Invalid or expired invitation link');
      }

      // Check if invitation has expired
      if (new Date(inviteData.expires_at) < new Date()) {
        console.log('Invitation has expired:', inviteData.expires_at);
        throw new Error('This invitation has expired');
      }

      console.log('Valid invitation found:', inviteData);
      setInvitation(inviteData);
      
      // Pre-fill form with invitation data
      setFormData(prev => ({
        ...prev,
        firstName: inviteData.first_name,
        lastName: inviteData.last_name,
        email: inviteData.email,
        phone: inviteData.phone || '',
      }));
      
    } catch (error: any) {
      console.error('Error fetching invitation:', error);
      toast({
        title: "Invalid Invitation",
        description: error.message,
        variant: "destructive",
      });
      navigate('/auth');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (fileType: keyof typeof uploadedFiles, file: File) => {
    if (!invitation?.id) {
      toast({
        title: "Upload failed",
        description: "Invitation data not available. Please refresh the page.",
        variant: "destructive",
      });
      return;
    }

    try {
      setUploadProgress(prev => ({ ...prev, [fileType]: 0 }));
      
      const fileExt = file.name.split('.').pop();
      // Use invitation ID as the folder since user isn't authenticated yet
      const fileName = `${invitation.id}/${fileType}.${fileExt}`;
      const bucketName = fileType === 'avatar' ? 'driver-avatars' : 'driver-documents';

      console.log(`Uploading ${fileType} to ${bucketName}/${fileName}`);

      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(fileName, file, {
          upsert: true,
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      setUploadedFiles(prev => ({ ...prev, [fileType]: file }));
      setUploadProgress(prev => ({ ...prev, [fileType]: 100 }));

      toast({
        title: "File uploaded successfully",
        description: `Your ${fileType} document has been uploaded.`,
      });

    } catch (error: any) {
      console.error('File upload failed:', error);
      toast({
        title: "Upload failed",
        description: error.message || 'Failed to upload file. Please try again.',
        variant: "destructive",
      });
      setUploadProgress(prev => ({ ...prev, [fileType]: 0 }));
    }
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const validateCurrentStep = (): boolean => {
    switch (currentStep) {
      case 0: // Personal Info
        return !!(formData.firstName && formData.lastName && formData.email && formData.phone && formData.address);
      case 1: // Account Setup
        return !!(formData.password && formData.confirmPassword && formData.password === formData.confirmPassword && formData.password.length >= 8);
      case 2: // Documents
        return !!(uploadedFiles.license && uploadedFiles.insurance && uploadedFiles.rightToWork && formData.licenseNumber);
      case 3: // Terms
        return !!(formData.acceptTerms && formData.acceptPrivacy);
      default:
        return false;
    }
  };

  const completeOnboarding = async () => {
    if (!invitation) return;
    setLoading(true);

    try {
      console.log('Starting onboarding for email:', invitation.email);
      
      // Always try to create/sign in the user first
      let authResult;
      let finalUserId;
      
      if (!user) {
        console.log('No existing user, creating new account without email confirmation...');
        
        // Create confirmed user via edge function (bypasses email confirmation)
        const { data: createUserResponse, error: createUserError } = await supabase.functions.invoke('create-confirmed-driver', {
          body: {
            email: invitation.email,
            password: formData.password,
            userData: {
              first_name: invitation.first_name,
              last_name: invitation.last_name,
              user_type: 'driver'
            }
          }
        });

        if (createUserError || !createUserResponse.success) {
          console.log('Create user error:', createUserError || createUserResponse.error);
          // If user already exists, try to sign in
          if (createUserResponse?.error?.includes('User already registered') || createUserError?.message?.includes('already been registered')) {
            console.log('User exists, trying to sign in...');
            authResult = await supabase.auth.signInWithPassword({
              email: invitation.email,
              password: formData.password,
            });
            console.log('Sign in result:', authResult);
            
            if (authResult.error) {
              throw new Error(`Authentication failed: ${authResult.error.message}`);
            }
            
            finalUserId = authResult.data?.user?.id;
          } else {
            throw new Error(`User creation failed: ${createUserError?.message || createUserResponse.error}`);
          }
        } else {
          // User created successfully via edge function, now sign them in
          console.log('User created successfully, signing in...');
          authResult = await supabase.auth.signInWithPassword({
            email: invitation.email,
            password: formData.password,
          });
          console.log('Sign in result after creation:', authResult);
          
          if (authResult.error) {
            throw new Error(`Sign in failed after user creation: ${authResult.error.message}`);
          }
          
          finalUserId = authResult.data?.user?.id;
          console.log('Authentication successful, user ID:', finalUserId);

          // Edge function already created all profiles and updated invitation status
          // Just redirect to dashboard
          console.log('Onboarding completed successfully via edge function');
          toast({
            title: "Welcome!",
            description: "Your account has been created successfully.",
          });
          
          navigate('/dashboard');
          return;
        }

        if (!authResult.data?.user) {
          throw new Error('Failed to authenticate - no user data returned');
        }

        finalUserId = authResult.data.user.id;
        console.log('Authentication successful, user ID:', finalUserId);

        // For onboarding, we can use the user ID directly even without active session
        // The user exists in auth.users table, which is what matters for foreign key
        
      } else {
        console.log('Using existing user:', user.id);
        finalUserId = user.id;
      }

      // Create both driver profile and user profile
      console.log('Creating driver profile and user profile with user_id:', finalUserId);
      
      // First create the user profile in profiles table
      const profileData = {
        user_id: finalUserId,
        email: invitation.email,
        first_name: invitation.first_name,
        last_name: invitation.last_name,
        user_type: 'driver',
        company_id: invitation.company_id,
      };
      
      console.log('Inserting user profile data:', profileData);
      const { error: profileCreateError } = await supabase
        .from('profiles')
        .insert(profileData);
      
      if (profileCreateError) {
        console.error('Profile creation error:', profileCreateError);
        throw new Error(`Profile creation failed: ${profileCreateError.message}`);
      }

      // Then create the driver profile
      const driverProfileData = {
        user_id: finalUserId,
        company_id: invitation.company_id,
        parcel_rate: invitation.parcel_rate || invitation.hourly_rate || 0,
        driving_license_number: formData.licenseNumber,
        license_expiry: formData.licenseExpiry || null,
        status: 'active',
        onboarding_completed_at: new Date().toISOString(),
        onboarding_progress: {
          personal_info: true,
          account_setup: true,
          documents_uploaded: true,
          terms_accepted: true,
        },
      };

      console.log('Inserting driver profile data:', driverProfileData);
      const { data: profileInsertData, error: profileError } = await supabase
        .from('driver_profiles')
        .insert(driverProfileData)
        .select()
        .single();

      if (profileError) {
        console.error('Profile creation error:', profileError);
        throw new Error(`Profile creation failed: ${profileError.message}`);
      }

      console.log('Driver profile created successfully:', profileInsertData);

      // Update invitation status
      const { error: inviteError } = await supabase
        .from('driver_invitations')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString(),
          driver_profile_id: profileInsertData.id,
        })
        .eq('id', invitation.id);

      if (inviteError) {
        console.warn('Failed to update invitation:', inviteError);
      }

      toast({
        title: "Welcome to the team! 🎉",
        description: "Onboarding complete. Redirecting...",
      });

      // Simple redirect after a short delay
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 1000);

    } catch (error: any) {
      console.error('Onboarding completion error:', error);
      toast({
        title: "Error completing onboarding",
        description: error.message || 'An unexpected error occurred. Please try again.',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-muted-foreground">Loading your invitation...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentStepData = steps[currentStep];
  const progressPercentage = ((currentStep + 1) / steps.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to the Team! 🚗</h1>
          <p className="text-muted-foreground">Complete your onboarding to get started</p>
        </div>

        {/* Progress */}
        <Card className="mb-6">
          <CardContent className="py-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium">Step {currentStep + 1} of {steps.length}</span>
              <span className="text-sm text-muted-foreground">{Math.round(progressPercentage)}% Complete</span>
            </div>
            <Progress value={progressPercentage} className="mb-4" />
            <div className="flex items-center justify-between">
              {steps.map((step, index) => (
                <div key={step.id} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    index <= currentStep ? 'bg-primary text-primary-foreground' : 'bg-gray-200 text-gray-600'
                  }`}>
                    {index < currentStep ? <CheckCircle className="w-4 h-4" /> : index + 1}
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`w-4 h-1 ${index < currentStep ? 'bg-primary' : 'bg-gray-200'}`} />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Current Step */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              {currentStep === 0 && <User className="w-5 h-5" />}
              {currentStep === 1 && <Lock className="w-5 h-5" />}
              {currentStep === 2 && <FileText className="w-5 h-5" />}
              {currentStep === 3 && <Shield className="w-5 h-5" />}
              <span>{currentStepData.title}</span>
            </CardTitle>
            <CardDescription>{currentStepData.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Step Content */}
            {currentStep === 0 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input
                      id="firstName"
                      value={formData.firstName}
                      onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input
                      id="lastName"
                      value={formData.lastName}
                      onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    disabled
                    className="bg-gray-50"
                  />
                </div>
                
                <div>
                  <Label htmlFor="phone">Phone Number *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="address">Home Address *</Label>
                  <Textarea
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                    required
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="emergencyContact">Emergency Contact Name</Label>
                    <Input
                      id="emergencyContact"
                      value={formData.emergencyContact}
                      onChange={(e) => setFormData(prev => ({ ...prev, emergencyContact: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="emergencyPhone">Emergency Contact Phone</Label>
                    <Input
                      id="emergencyPhone"
                      type="tel"
                      value={formData.emergencyPhone}
                      onChange={(e) => setFormData(prev => ({ ...prev, emergencyPhone: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
            )}

            {currentStep === 1 && (
              <div className="space-y-4">
                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertDescription>
                    Create a strong password with at least 8 characters, including uppercase, lowercase, numbers, and special characters.
                  </AlertDescription>
                </Alert>
                
                <div>
                  <Label htmlFor="password">Password *</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="confirmPassword">Confirm Password *</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  {formData.password && formData.confirmPassword && formData.password !== formData.confirmPassword && (
                    <p className="text-sm text-destructive mt-1">Passwords do not match</p>
                  )}
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-6">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Please upload clear, readable photos or scans of your documents. All documents are required.
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="licenseNumber">License Number *</Label>
                    <Input
                      id="licenseNumber"
                      value={formData.licenseNumber}
                      onChange={(e) => setFormData(prev => ({ ...prev, licenseNumber: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="licenseExpiry">License Expiry Date *</Label>
                    <Input
                      id="licenseExpiry"
                      type="date"
                      value={formData.licenseExpiry}
                      onChange={(e) => setFormData(prev => ({ ...prev, licenseExpiry: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                {/* File Upload Areas */}
                {(['license', 'insurance', 'rightToWork'] as const).map((docType) => (
                  <div key={docType} className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <Input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(docType, file);
                      }}
                      className="hidden"
                      id={`upload-${docType}`}
                    />
                    <Label htmlFor={`upload-${docType}`} className="cursor-pointer">
                      <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                      <p className="text-sm font-medium">
                        {docType === 'license' && 'Driving License'}
                        {docType === 'insurance' && 'Insurance Certificate'}
                        {docType === 'rightToWork' && 'Right to Work Document'}
                      </p>
                      <p className="text-xs text-gray-500">Click to upload or drag and drop</p>
                    </Label>
                    {uploadedFiles[docType] && (
                      <Badge variant="default" className="mt-2">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Uploaded
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="acceptTerms"
                      checked={formData.acceptTerms}
                      onCheckedChange={(checked) => 
                        setFormData(prev => ({ ...prev, acceptTerms: checked as boolean }))
                      }
                    />
                    <Label htmlFor="acceptTerms" className="text-sm leading-relaxed">
                      I accept the <a href="#" className="text-primary underline">Terms and Conditions</a> and agree to follow all company policies and procedures.
                    </Label>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="acceptPrivacy"
                      checked={formData.acceptPrivacy}
                      onCheckedChange={(checked) => 
                        setFormData(prev => ({ ...prev, acceptPrivacy: checked as boolean }))
                      }
                    />
                    <Label htmlFor="acceptPrivacy" className="text-sm leading-relaxed">
                      I acknowledge that I have read and understand the <a href="#" className="text-primary underline">Privacy Policy</a>.
                    </Label>
                  </div>
                </div>

                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>You're almost done!</strong> Once you complete this step, you'll have full access to your driver dashboard and can start working immediately.
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between pt-6">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={currentStep === 0}
              >
                Previous
              </Button>
              
              {currentStep < steps.length - 1 ? (
                <Button
                  onClick={handleNext}
                  disabled={!validateCurrentStep()}
                >
                  Next
                </Button>
              ) : (
                <Button
                  onClick={completeOnboarding}
                  disabled={!validateCurrentStep()}
                  className="bg-green-600 hover:bg-green-700"
                >
                  Complete Onboarding 🎉
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DriverOnboarding;