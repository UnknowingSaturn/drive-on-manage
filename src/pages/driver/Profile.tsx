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
import { Upload, FileText, User, Car, CheckCircle2, AlertCircle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const DriverProfile = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    firstName: profile?.first_name || '',
    lastName: profile?.last_name || '',
    phone: profile?.phone || '',
    licenseNumber: '',
    licenseExpiry: '',
    employeeId: ''
  });

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate(formData);
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
            {/* Onboarding Progress */}
            <Card className="logistics-card">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CheckCircle2 className="h-5 w-5 text-primary mr-2" />
                  Onboarding Progress
                </CardTitle>
                <CardDescription>
                  Complete all sections to finish your onboarding
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Overall Progress</span>
                    <Badge variant={status.percentage === 100 ? "default" : "secondary"}>
                      {status.completed}/{status.total} Complete
                    </Badge>
                  </div>
                  <div className="w-full bg-muted rounded-full h-3">
                    <div 
                      className="bg-gradient-primary h-3 rounded-full transition-all duration-500 route-indicator"
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

            <Tabs defaultValue="personal" className="space-y-4 md:space-y-6">
              <TabsList className="grid w-full grid-cols-3 h-auto p-1">
                <TabsTrigger value="personal" className="text-xs sm:text-sm mobile-button">Personal Details</TabsTrigger>
                <TabsTrigger value="documents" className="text-xs sm:text-sm mobile-button">Documents</TabsTrigger>
                <TabsTrigger value="employment" className="text-xs sm:text-sm mobile-button">Employment</TabsTrigger>
              </TabsList>

              <TabsContent value="personal" className="space-y-6">
                <Card className="logistics-card">
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <User className="h-5 w-5 text-primary mr-2" />
                      Personal Information
                    </CardTitle>
                    <CardDescription>
                      Update your personal details
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="firstName">First Name</Label>
                          <Input
                            id="firstName"
                            value={formData.firstName}
                            onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                            placeholder="Enter your first name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="lastName">Last Name</Label>
                          <Input
                            id="lastName"
                            value={formData.lastName}
                            onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                            placeholder="Enter your last name"
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="phone">Phone Number</Label>
                        <Input
                          id="phone"
                          value={formData.phone}
                          onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                          placeholder="Enter your phone number"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          value={profile?.email || ''}
                          disabled
                          className="bg-muted"
                        />
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
                        <Button variant="outline" size="sm">
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
                        <Button variant="outline" size="sm">
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
                        <Button variant="outline" size="sm">
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
                      <Label htmlFor="employeeId">Employee ID</Label>
                      <Input
                        id="employeeId"
                        value={driverProfile?.employee_id || ''}
                        disabled
                        className="bg-muted"
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Hourly Rate</Label>
                        <div className="text-lg font-semibold text-gradient">
                          £{driverProfile?.hourly_rate || 'Not set'}
                          {driverProfile?.hourly_rate && '/hour'}
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
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default DriverProfile;