import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Settings, DollarSign, Bell, FileText, Clock, Shield, Users, KeyRound } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import TeamManagement from '@/components/TeamManagement';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const AdminSettings = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch company settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ['company-settings', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return null;
      
      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .eq('company_id', profile.company_id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      // Return default settings if none exist
      return data || {
        default_parcel_rate: 0.75,
        default_cover_rate: 1.00,
        default_base_pay: 10.00,
        standard_work_hours: 8,
        overtime_rate_multiplier: 1.5,
        email_notifications: true,
        sms_notifications: false,
        require_license_upload: true,
        require_insurance_upload: true,
        require_right_to_work: true,
        require_vehicle_check: true,
        require_eod_screenshot: false,
        allow_late_submissions: true,
        late_submission_hours: 24,
        payment_frequency: 'weekly',
        payment_day: 5
      };
    },
    enabled: !!profile?.company_id
  });

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (newSettings: any) => {
      if (!profile?.company_id) throw new Error('No company ID');

      const { data, error } = await supabase
        .from('company_settings')
        .upsert({
          ...newSettings,
          company_id: profile.company_id
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Settings updated",
        description: "Your company settings have been successfully updated.",
      });
      queryClient.invalidateQueries({ queryKey: ['company-settings'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating settings",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const [pendingUpdates, setPendingUpdates] = useState<Record<string, any>>({});
  const [updateTimeout, setUpdateTimeout] = useState<NodeJS.Timeout | null>(null);
  const [resetPasswordModalOpen, setResetPasswordModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  // Fetch company staff (admins and supervisors) for password reset
  const { data: companyStaff } = useQuery({
    queryKey: ['company-staff', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      
      // Get user_companies entries for admins and supervisors
      const { data: userCompanies, error } = await supabase
        .from('user_companies')
        .select(`
          id,
          user_id,
          role,
          created_at
        `)
        .eq('company_id', profile.company_id)
        .neq('user_id', profile.user_id) // Exclude current user
        .in('role', ['admin', 'supervisor'])
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!userCompanies?.length) return [];

      // Get profile information for these users
      const userIds = userCompanies.map(uc => uc.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, email, is_active, created_at, user_type')
        .in('user_id', userIds)
        .in('user_type', ['admin', 'supervisor']);

      if (profilesError) throw profilesError;

      // Combine the data
      return userCompanies.map(uc => {
        const profile = profiles?.find(p => p.user_id === uc.user_id);
        return {
          ...uc,
          ...profile
        };
      });
    },
    enabled: !!profile?.company_id
  });

  // Password reset mutation
  const resetPasswordMutation = useMutation({
    mutationFn: async (user: any) => {
      const { data, error } = await supabase.functions.invoke('reset-user-password', {
        body: {
          userId: user.user_id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          userType: user.user_type
        }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Password reset successful",
        description: data.message || "New credentials have been sent via email."
      });
      setResetPasswordModalOpen(false);
      setSelectedUser(null);
    },
    onError: (error: any) => {
      toast({
        title: "Password reset failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleResetPassword = (user: any) => {
    setSelectedUser(user);
    setResetPasswordModalOpen(true);
  };

  const confirmResetPassword = () => {
    if (selectedUser) {
      resetPasswordMutation.mutate(selectedUser);
    }
  };

  const updateSetting = (key: string, value: any) => {
    if (!settings) return;
    
    // Update local state immediately for responsive UI
    setPendingUpdates(prev => ({ ...prev, [key]: value }));
    
    // Clear existing timeout
    if (updateTimeout) {
      clearTimeout(updateTimeout);
    }
    
    // Set new timeout for debounced API call
    const newTimeout = setTimeout(() => {
      const newSettings = { ...settings, ...pendingUpdates, [key]: value };
      updateSettingsMutation.mutate(newSettings);
      setPendingUpdates({});
    }, 1000); // 1 second debounce
    
    setUpdateTimeout(newTimeout);
  };

  if (isLoading) {
    return (
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-background">
          <AppSidebar />
          <SidebarInset className="flex-1">
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p>Loading settings...</p>
              </div>
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        
        <SidebarInset className="flex-1">
          <header className="border-b bg-card sticky top-0 z-10">
            <div className="flex items-center px-4 py-4">
              <SidebarTrigger className="mr-4" />
              <div>
                <h1 className="text-xl font-semibold text-foreground">Settings</h1>
                <p className="text-sm text-muted-foreground">Manage your company configuration</p>
              </div>
            </div>
          </header>

          <main className="p-6 space-y-6 max-w-4xl">
            {/* General Settings */}
            <Card className="logistics-card">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Settings className="h-5 w-5 mr-2" />
                  General Settings
                </CardTitle>
                <CardDescription>
                  Basic configuration for your company operations
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="work-hours">Standard Work Hours</Label>
                    <Input
                      id="work-hours"
                      type="number"
                      value={pendingUpdates.standard_work_hours ?? settings?.standard_work_hours ?? 8}
                      onChange={(e) => updateSetting('standard_work_hours', parseInt(e.target.value))}
                      min="1"
                      max="24"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="overtime-multiplier">Overtime Rate Multiplier</Label>
                    <Input
                      id="overtime-multiplier"
                      type="number"
                      step="0.1"
                      value={pendingUpdates.overtime_rate_multiplier ?? settings?.overtime_rate_multiplier ?? 1.5}
                      onChange={(e) => updateSetting('overtime_rate_multiplier', parseFloat(e.target.value))}
                      min="1"
                      max="3"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Rates & Pay */}
            <Card className="logistics-card">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <DollarSign className="h-5 w-5 mr-2" />
                  Default Rates & Pay
                </CardTitle>
                <CardDescription>
                  Set default payment rates for new drivers
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="parcel-rate">Default Parcel Rate (£)</Label>
                    <Input
                      id="parcel-rate"
                      type="number"
                      step="0.01"
                      value={pendingUpdates.default_parcel_rate ?? settings?.default_parcel_rate ?? 0.75}
                      onChange={(e) => updateSetting('default_parcel_rate', parseFloat(e.target.value))}
                      min="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cover-rate">Default Cover Rate (£)</Label>
                    <Input
                      id="cover-rate"
                      type="number"
                      step="0.01"
                      value={pendingUpdates.default_cover_rate ?? settings?.default_cover_rate ?? 1.00}
                      onChange={(e) => updateSetting('default_cover_rate', parseFloat(e.target.value))}
                      min="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="base-pay">Default Base Pay (£)</Label>
                    <Input
                      id="base-pay"
                      type="number"
                      step="0.01"
                      value={pendingUpdates.default_base_pay ?? settings?.default_base_pay ?? 10.00}
                      onChange={(e) => updateSetting('default_base_pay', parseFloat(e.target.value))}
                      min="0"
                    />
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="payment-frequency">Payment Frequency</Label>
                    <Select
                      value={settings?.payment_frequency || 'weekly'}
                      onValueChange={(value) => updateSetting('payment_frequency', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="biweekly">Bi-weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="payment-day">Payment Day</Label>
                    <Input
                      id="payment-day"
                      type="number"
                      value={pendingUpdates.payment_day ?? settings?.payment_day ?? 5}
                      onChange={(e) => updateSetting('payment_day', parseInt(e.target.value))}
                      min="1"
                      max="31"
                      placeholder="Day of week (1-7) or month (1-31)"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Notifications */}
            <Card className="logistics-card">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Bell className="h-5 w-5 mr-2" />
                  Notification Preferences
                </CardTitle>
                <CardDescription>
                  Configure how your company receives notifications
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="email-notifications">Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive important updates via email
                    </p>
                  </div>
                  <Switch
                    id="email-notifications"
                    checked={settings?.email_notifications || false}
                    onCheckedChange={(checked) => updateSetting('email_notifications', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="sms-notifications">SMS Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive urgent alerts via SMS
                    </p>
                  </div>
                  <Switch
                    id="sms-notifications"
                    checked={settings?.sms_notifications || false}
                    onCheckedChange={(checked) => updateSetting('sms_notifications', checked)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Document Requirements */}
            <Card className="logistics-card">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FileText className="h-5 w-5 mr-2" />
                  Document Requirements
                </CardTitle>
                <CardDescription>
                  Configure which documents are required for driver onboarding
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="require-license">Driving License Upload</Label>
                    <p className="text-sm text-muted-foreground">
                      Require drivers to upload their driving license
                    </p>
                  </div>
                  <Switch
                    id="require-license"
                    checked={settings?.require_license_upload || false}
                    onCheckedChange={(checked) => updateSetting('require_license_upload', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="require-insurance">Insurance Document</Label>
                    <p className="text-sm text-muted-foreground">
                      Require drivers to upload insurance documentation
                    </p>
                  </div>
                  <Switch
                    id="require-insurance"
                    checked={settings?.require_insurance_upload || false}
                    onCheckedChange={(checked) => updateSetting('require_insurance_upload', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="require-rtw">Right to Work Document</Label>
                    <p className="text-sm text-muted-foreground">
                      Require drivers to upload right to work proof
                    </p>
                  </div>
                  <Switch
                    id="require-rtw"
                    checked={settings?.require_right_to_work || false}
                    onCheckedChange={(checked) => updateSetting('require_right_to_work', checked)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Operational Settings */}
            <Card className="logistics-card">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Clock className="h-5 w-5 mr-2" />
                  Operational Settings
                </CardTitle>
                <CardDescription>
                  Configure daily operational requirements
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="require-vehicle-check">Vehicle Check Required</Label>
                    <p className="text-sm text-muted-foreground">
                      Require drivers to complete vehicle checks before starting
                    </p>
                  </div>
                  <Switch
                    id="require-vehicle-check"
                    checked={settings?.require_vehicle_check || false}
                    onCheckedChange={(checked) => updateSetting('require_vehicle_check', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="require-eod-screenshot">EOD Screenshot Required</Label>
                    <p className="text-sm text-muted-foreground">
                      Require drivers to upload screenshots with EOD reports
                    </p>
                  </div>
                  <Switch
                    id="require-eod-screenshot"
                    checked={settings?.require_eod_screenshot || false}
                    onCheckedChange={(checked) => updateSetting('require_eod_screenshot', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="allow-late-submissions">Allow Late Submissions</Label>
                    <p className="text-sm text-muted-foreground">
                      Allow drivers to submit reports after the deadline
                    </p>
                  </div>
                  <Switch
                    id="allow-late-submissions"
                    checked={settings?.allow_late_submissions || false}
                    onCheckedChange={(checked) => updateSetting('allow_late_submissions', checked)}
                  />
                </div>

                {settings?.allow_late_submissions && (
                  <div className="space-y-2">
                    <Label htmlFor="late-submission-hours">Late Submission Window (hours)</Label>
                    <Input
                      id="late-submission-hours"
                      type="number"
                      value={pendingUpdates.late_submission_hours ?? settings?.late_submission_hours ?? 24}
                      onChange={(e) => updateSetting('late_submission_hours', parseInt(e.target.value))}
                      min="1"
                      max="168"
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* User Management */}
            <Card className="logistics-card">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="h-5 w-5 mr-2" />
                  User Management
                </CardTitle>
                <CardDescription>
                  Manage admin and supervisor accounts
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Password Reset</Label>
                    <p className="text-sm text-muted-foreground">
                      Reset passwords for admins and supervisors in your company
                    </p>
                  </div>
                  
                  {companyStaff && companyStaff.length > 0 ? (
                    <div className="space-y-3">
                      {companyStaff.map((user) => (
                        <div key={user.user_id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="space-y-1">
                            <p className="font-medium">{user.first_name} {user.last_name}</p>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                user.user_type === 'admin' 
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' 
                                  : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              }`}>
                                {user.user_type}
                              </span>
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                user.is_active 
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                                  : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                              }`}>
                                {user.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleResetPassword(user)}
                            disabled={resetPasswordMutation.isPending}
                          >
                            <KeyRound className="h-4 w-4 mr-2" />
                            Reset Password
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No staff members found in your company
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Remove Team Management from Settings - now in Driver Management */}
          </main>

          {/* Password Reset Confirmation Modal */}
          <Dialog open={resetPasswordModalOpen} onOpenChange={setResetPasswordModalOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Reset Password</DialogTitle>
                <DialogDescription>
                  Are you sure you want to reset the password for {selectedUser?.first_name} {selectedUser?.last_name}? 
                  A new temporary password will be generated and sent to their email address.
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-end space-x-2 mt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setResetPasswordModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={confirmResetPassword}
                  disabled={resetPasswordMutation.isPending}
                >
                  {resetPasswordMutation.isPending ? 'Resetting...' : 'Reset Password'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default AdminSettings;