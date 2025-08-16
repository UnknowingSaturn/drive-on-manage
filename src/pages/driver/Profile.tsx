import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { MobileNav } from '@/components/MobileNav';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, User, Car, CheckCircle2, AlertCircle, DollarSign, Star, Trophy, Receipt } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

const DriverProfile = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    firstName: profile?.first_name || '',
    lastName: profile?.last_name || '',
    phone: profile?.phone || '',
    licenseNumber: '',
    licenseExpiry: '',
    employeeId: ''
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [showPasswordForm, setShowPasswordForm] = useState(false);

  // Fetch driver profile data
  const { data: driverProfile, isLoading } = useQuery({
    queryKey: ['driver-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('driver_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user?.id
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          first_name: data.firstName,
          last_name: data.lastName,
          phone: data.phone
        })
        .eq('user_id', user?.id);

      if (profileError) throw profileError;

      const { error: driverError } = await supabase
        .from('driver_profiles')
        .upsert({
          user_id: user?.id,
          company_id: profile?.company_id,
          driving_license_number: data.licenseNumber,
          license_expiry: data.licenseExpiry || null,
          employee_id: data.employeeId
        });

      if (driverError) throw driverError;
    },
    onSuccess: () => {
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['driver-profile'] });
    },
    onError: (error) => {
      toast({
        title: "Error updating profile",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Change password mutation
  const changePasswordMutation = useMutation({
    mutationFn: async (passwords: { currentPassword: string; newPassword: string }) => {
      const { error } = await supabase.auth.updateUser({
        password: passwords.newPassword
      });
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Password changed",
        description: "Your password has been updated successfully.",
      });
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setShowPasswordForm(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error changing password",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Password reset mutation
  const passwordResetMutation = useMutation({
    mutationFn: async () => {
      if (!user?.email) throw new Error('No email found');
      
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/reset-password`
      });
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Password reset email sent",
        description: "Check your email for a password reset link. The link will expire in 1 hour.",
      });
      setShowPasswordForm(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error sending reset email",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate(formData);
  };

  const handlePasswordReset = () => {
    passwordResetMutation.mutate();
  };

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: "Password mismatch",
        description: "New password and confirmation password do not match.",
        variant: "destructive",
      });
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters long.",
        variant: "destructive",
      });
      return;
    }

    changePasswordMutation.mutate({
      currentPassword: passwordData.currentPassword,
      newPassword: passwordData.newPassword
    });
  };

  const handleDocumentUpload = (documentType: string) => {
    // Create a file input element
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,application/pdf';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        // Show upload progress
        toast({
          title: "Uploading document...",
          description: "Please wait while your document is being uploaded.",
        });

        // Upload to Supabase storage
        const fileExt = file.name.split('.').pop();
        const fileName = `${user?.id}/${documentType}_${Date.now()}.${fileExt}`;
        
        const { data, error } = await supabase.storage
          .from('driver-documents')
          .upload(fileName, file);

        if (error) throw error;

        // Update driver profile with document URL
        const { error: updateError } = await supabase
          .from('driver_profiles')
          .update({
            [`${documentType}_document`]: data.path
          })
          .eq('user_id', user?.id);

        if (updateError) throw updateError;

        toast({
          title: "Document uploaded successfully",
          description: "Your document has been saved to your profile.",
        });

        // Refresh the profile data
        queryClient.invalidateQueries({ queryKey: ['driver-profile'] });

      } catch (error: any) {
        toast({
          title: "Upload failed",
          description: error.message || "Failed to upload document.",
          variant: "destructive",
        });
      }
    };
    input.click();
  };

  const getOnboardingStatus = () => {
    const checks = [
      { label: 'Personal Details', completed: !!(formData.firstName && formData.lastName) },
      { label: 'Contact Information', completed: !!(formData.phone) },
      { label: 'Driving License', completed: !!(driverProfile?.driving_license_number) },
      { label: 'Right to Work Document', completed: !!(driverProfile?.right_to_work_document) },
      { label: 'Insurance Document', completed: !!(driverProfile?.insurance_document) },
    ];
    
    const completed = checks.filter(check => check.completed).length;
    const total = checks.length;
    
    return { checks, completed, total, percentage: Math.round((completed / total) * 100) };
  };

  const status = getOnboardingStatus();

  if (isLoading) {
    return (
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-background">
          <AppSidebar />
          <SidebarInset className="flex-1">
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p>Loading profile...</p>
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
                  <h1 className="mobile-heading font-semibold text-foreground">My Profile</h1>
                  <p className="text-xs md:text-sm text-muted-foreground">Manage your personal information and onboarding</p>
                </div>
              </div>
            </div>
          </header>

          <main className="mobile-padding py-4 md:py-6 space-y-4 md:space-y-6 no-overflow">
            <div className="max-w-4xl mx-auto space-y-4 md:space-y-6">
              {/* Onboarding Progress */}
              <Card className="logistics-card">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center text-lg">
                    <CheckCircle2 className="h-5 w-5 text-primary mr-2" />
                    Onboarding Progress
                  </CardTitle>
                  <CardDescription className="text-sm">
                    Complete all sections to finish your onboarding
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Overall Progress</span>
                      <Badge variant={status.percentage === 100 ? "default" : "secondary"} className="text-xs">
                        {status.completed}/{status.total} Complete
                      </Badge>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-gradient-primary h-2 rounded-full transition-all duration-500 route-indicator"
                        style={{ width: `${status.percentage}%` }}
                      ></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {status.checks.map((check, index) => (
                        <div key={index} className="flex items-center space-x-2">
                          {check.completed ? (
                            <CheckCircle2 className="h-4 w-4 text-success" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className={`text-sm ${check.completed ? 'text-success' : 'text-muted-foreground'}`}>
                            {check.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Driver Features Quick Access */}
              <Card className="logistics-card bg-gradient-subtle">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center text-gradient text-lg">
                    <Trophy className="h-5 w-5 text-primary mr-2" />
                    Driver Features
                  </CardTitle>
                  <CardDescription className="text-sm">
                    Quick access to earnings, leaderboard, feedback, and expense tracking
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Button 
                      variant="outline" 
                      className="h-14 flex-col space-y-1 hover-lift text-xs"
                      onClick={() => navigate('/driver/earnings')}
                    >
                      <DollarSign className="h-4 w-4 text-green-600" />
                      <span>Live Earnings</span>
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      className="h-14 flex-col space-y-1 hover-lift text-xs"
                      onClick={() => navigate('/driver/leaderboard')}
                    >
                      <Trophy className="h-4 w-4 text-yellow-600" />
                      <span>Leaderboard</span>
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      className="h-14 flex-col space-y-1 hover-lift text-xs"
                      onClick={() => navigate('/driver/feedback')}
                    >
                      <Star className="h-4 w-4 text-blue-600" />
                      <span>Route Feedback</span>
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      className="h-14 flex-col space-y-1 hover-lift text-xs"
                      onClick={() => navigate('/driver/expenses')}
                    >
                      <Receipt className="h-4 w-4 text-purple-600" />
                      <span>Expenses</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="max-w-4xl mx-auto">
              <Tabs defaultValue="personal" className="space-y-4 md:space-y-6">
                <TabsList className="grid w-full grid-cols-3 h-auto p-1">
                  <TabsTrigger value="personal" className="text-xs sm:text-sm mobile-button py-2">Personal Details</TabsTrigger>
                  <TabsTrigger value="documents" className="text-xs sm:text-sm mobile-button py-2">Documents</TabsTrigger>
                  <TabsTrigger value="employment" className="text-xs sm:text-sm mobile-button py-2">Employment</TabsTrigger>
                </TabsList>

                <TabsContent value="personal" className="space-y-6">
                  <Card className="logistics-card">
                    <CardHeader className="pb-4">
                      <CardTitle className="flex items-center text-lg">
                        <User className="h-5 w-5 text-primary mr-2" />
                        Personal Information
                      </CardTitle>
                      <CardDescription className="text-sm">
                        Update your personal details
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="firstName" className="text-sm font-medium">First Name</Label>
                            <Input
                              id="firstName"
                              value={formData.firstName}
                              onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                              placeholder="Enter your first name"
                              className="h-9"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="lastName" className="text-sm font-medium">Last Name</Label>
                            <Input
                              id="lastName"
                              value={formData.lastName}
                              onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                              placeholder="Enter your last name"
                              className="h-9"
                            />
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="phone" className="text-sm font-medium">Phone Number</Label>
                          <Input
                            id="phone"
                            value={formData.phone}
                            onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                            placeholder="Enter your phone number"
                            className="h-9"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                          <Input
                            id="email"
                            value={profile?.email || ''}
                            disabled
                            className="bg-muted h-9"
                          />
                        </div>

                      {/* Change Password Section */}
                      <div className="space-y-4 pt-4 border-t">
                        <div className="flex items-center justify-between">
                          <Label className="text-base font-medium">Password</Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setShowPasswordForm(!showPasswordForm)}
                          >
                            {showPasswordForm ? 'Cancel' : 'Change Password'}
                          </Button>
                        </div>
                        
                        {showPasswordForm && (
                          <div className="space-y-4 p-4 bg-muted rounded-lg">
                            <form onSubmit={handlePasswordChange} className="space-y-4">
                              <div className="space-y-2">
                                <Label htmlFor="currentPassword">Current Password</Label>
                                <Input
                                  id="currentPassword"
                                  type="password"
                                  value={passwordData.currentPassword}
                                  onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                                  placeholder="Enter current password"
                                  required
                                />
                              </div>
                              
                              <div className="space-y-2">
                                <Label htmlFor="newPassword">New Password</Label>
                                <Input
                                  id="newPassword"
                                  type="password"
                                  value={passwordData.newPassword}
                                  onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                                  placeholder="Enter new password (min. 6 characters)"
                                  required
                                  minLength={6}
                                />
                              </div>
                              
                              <div className="space-y-2">
                                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                                <Input
                                  id="confirmPassword"
                                  type="password"
                                  value={passwordData.confirmPassword}
                                  onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                                  placeholder="Confirm new password"
                                  required
                                />
                              </div>
                              
                              <div className="flex gap-2">
                                <Button 
                                  type="submit" 
                                  size="sm"
                                  disabled={changePasswordMutation.isPending}
                                  className="bg-primary hover:bg-primary/90"
                                >
                                  {changePasswordMutation.isPending ? 'Updating...' : 'Update Password'}
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setShowPasswordForm(false);
                                    setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                                  }}
                                >
                                  Cancel
                                </Button>
                              </div>
                              
                              <div className="pt-2 border-t">
                                <Button
                                  type="button"
                                  variant="link"
                                  size="sm"
                                  onClick={handlePasswordReset}
                                  disabled={passwordResetMutation.isPending}
                                  className="h-auto p-0 text-xs text-muted-foreground hover:text-primary"
                                >
                                  {passwordResetMutation.isPending ? 'Sending reset email...' : 'Forgot your current password? Reset via email'}
                                </Button>
                              </div>
                            </form>
                          </div>
                        )}
                      </div>

                      <Button
                        type="submit" 
                        className="logistics-button mobile-button w-full sm:w-auto"
                        disabled={updateProfileMutation.isPending}
                      >
                        {updateProfileMutation.isPending ? 'Updating...' : 'Update Profile'}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="documents" className="space-y-6">
                <div className="grid gap-6">
                  <Card className="logistics-card">
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <FileText className="h-5 w-5 text-primary mr-2" />
                        Right to Work Document
                      </CardTitle>
                      <CardDescription>
                        Upload your right to work documentation
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="border-2 border-dashed border-muted rounded-lg p-6 text-center">
                        <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground mb-2">
                          {driverProfile?.right_to_work_document ? 'Document uploaded' : 'No document uploaded'}
                        </p>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleDocumentUpload('right_to_work')}
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          Upload Document
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="logistics-card">
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <Car className="h-5 w-5 text-primary mr-2" />
                        Driving License
                      </CardTitle>
                      <CardDescription>
                        Upload your driving license and enter details
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="licenseNumber">License Number</Label>
                          <Input
                            id="licenseNumber"
                            value={formData.licenseNumber}
                            onChange={(e) => setFormData(prev => ({ ...prev, licenseNumber: e.target.value }))}
                            placeholder="Enter license number"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="licenseExpiry">Expiry Date</Label>
                          <Input
                            id="licenseExpiry"
                            type="date"
                            value={formData.licenseExpiry}
                            onChange={(e) => setFormData(prev => ({ ...prev, licenseExpiry: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div className="border-2 border-dashed border-muted rounded-lg p-6 text-center">
                        <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground mb-2">
                          {driverProfile?.driving_license_document ? 'License uploaded' : 'No license uploaded'}
                        </p>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleDocumentUpload('driving_license')}
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          Upload License
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="logistics-card">
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <FileText className="h-5 w-5 text-primary mr-2" />
                        Insurance Document
                      </CardTitle>
                      <CardDescription>
                        Upload your insurance documentation
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="border-2 border-dashed border-muted rounded-lg p-6 text-center">
                        <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground mb-2">
                          {driverProfile?.insurance_document ? 'Insurance uploaded' : 'No insurance uploaded'}
                        </p>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleDocumentUpload('insurance')}
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          Upload Insurance
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="employment" className="space-y-6">
                <Card className="logistics-card">
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <User className="h-5 w-5 text-primary mr-2" />
                      Employment Details
                    </CardTitle>
                    <CardDescription>
                      View your employment information
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Driver ID</Label>
                      <div className="text-sm bg-muted p-2 rounded border">
                        {driverProfile?.id || 'Not assigned'}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Daily Base Rate</Label>
                        <div className="text-lg font-semibold text-gradient">
                          £10.00/day
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Parcel Rate</Label>
                        <div className="text-lg font-semibold text-gradient">
                          £{driverProfile?.parcel_rate || 'Not set'}
                          {driverProfile?.parcel_rate && '/parcel'}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Badge variant={driverProfile?.status === 'active' ? 'default' : 'secondary'}>
                        {driverProfile?.status || 'Pending'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
                </Tabs>
              </div>
            </main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    );
};

export default DriverProfile;