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
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

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

  // Change password mutation
  const changePasswordMutation = useMutation({
    mutationFn: async (passwords: { currentPassword: string; newPassword: string }) => {
      const { error } = await supabase.auth.updateUser({
        password: passwords.newPassword
      });
      
      if (error) throw error;
      return { success: true };
    },
    onSuccess: () => {
      toast({
        title: "Password changed successfully",
        description: "Your password has been updated."
      });
      setShowChangePassword(false);
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    },
    onError: (error: any) => {
      toast({
        title: "Password change failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({
        title: "Password mismatch",
        description: "New password and confirmation don't match.",
        variant: "destructive"
      });
      return;
    }
    
    if (passwordForm.newPassword.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters long.",
        variant: "destructive"
      });
      return;
    }
    
    changePasswordMutation.mutate({
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword
    });
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

            {/* Personal Account Settings */}
            <Card className="logistics-card">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Shield className="h-5 w-5 mr-2" />
                  Account Security
                </CardTitle>
                <CardDescription>
                  Manage your personal account security settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Change Password</Label>
                    <p className="text-sm text-muted-foreground">
                      Update your account password for security
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setShowChangePassword(!showChangePassword)}
                  >
                    <KeyRound className="h-4 w-4 mr-2" />
                    {showChangePassword ? 'Cancel' : 'Change Password'}
                  </Button>
                </div>

                {showChangePassword && (
                  <form onSubmit={handlePasswordChange} className="space-y-4 border-t pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="current-password">Current Password</Label>
                      <Input
                        id="current-password"
                        type="password"
                        value={passwordForm.currentPassword}
                        onChange={(e) => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-password">New Password</Label>
                      <Input
                        id="new-password"
                        type="password"
                        value={passwordForm.newPassword}
                        onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                        required
                        minLength={6}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-password">Confirm New Password</Label>
                      <Input
                        id="confirm-password"
                        type="password"
                        value={passwordForm.confirmPassword}
                        onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                        required
                        minLength={6}
                      />
                    </div>
                    <div className="flex justify-end space-x-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowChangePassword(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={changePasswordMutation.isPending}
                      >
                        {changePasswordMutation.isPending ? 'Updating...' : 'Update Password'}
                      </Button>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default AdminSettings;