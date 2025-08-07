import React, { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Mail, Phone, UserCheck, UserX, Edit, Trash2, Clock, AlertCircle, Eye, EyeOff, FileText, Truck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { ConfirmDelete } from '@/components/ConfirmDelete';
import { SmartSearch } from '@/components/SmartSearch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { validateForm, sanitizeInput, emailSchema, nameSchema, phoneSchema, parcelRateSchema } from '@/lib/security';
import { z } from 'zod';

// Validation schema for driver invitation
const driverInviteSchema = z.object({
  email: emailSchema,
  firstName: nameSchema,
  lastName: nameSchema,
  phone: phoneSchema,
  parcelRate: z.string().optional()
});

const DriverManagement = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [showFormErrors, setShowFormErrors] = useState(false);
  const [filteredDrivers, setFilteredDrivers] = useState<any[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<any>(null);
  const [showDocuments, setShowDocuments] = useState<Record<string, boolean>>({});
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    parcelRate: '',
    coverRate: ''
  });
  const [editFormData, setEditFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    parcelRate: '',
    coverRate: '',
    status: '',
    assignedVanId: ''
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [editFormErrors, setEditFormErrors] = useState<Record<string, string>>({});

  // Fetch drivers and invitations for the company
  const { data: drivers = [], isLoading, error } = useQuery({
    queryKey: ['drivers', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      
      // Fetch active driver profiles with van assignments
      const { data: drivers, error: driversError } = await supabase
        .from('driver_profiles')
        .select(`
          *,
          assigned_van:vans(id, registration, make, model)
        `)
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false });

      if (driversError) throw driversError;

      // Fetch pending invitations
      const { data: invitations, error: invitationsError } = await supabase
        .from('driver_invitations')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (invitationsError) throw invitationsError;

      // Fetch profile data for active drivers
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, email, phone, is_active')
        .in('user_id', drivers?.map(d => d.user_id) || []);

      if (profilesError) throw profilesError;

      // Combine active drivers with their profiles
      const activeDrivers = drivers?.map(driver => ({
        ...driver,
        type: 'active' as const,
        profiles: profiles?.find(p => p.user_id === driver.user_id),
        invitation_status: driver.onboarding_completed_at ? 'completed' : 'in_progress'
      })) || [];

      // Add pending invitations as "drivers"
      const pendingDrivers = invitations?.map(invite => ({
        id: invite.id,
        type: 'invitation' as const,
        status: 'pending',
        invitation_status: 'pending',
        user_id: null,
        company_id: invite.company_id,
        parcel_rate: (invite as any).parcel_rate || (invite as any).hourly_rate,
        cover_rate: (invite as any).cover_rate,
        created_at: invite.created_at,
        expires_at: invite.expires_at,
        profiles: {
          first_name: invite.first_name,
          last_name: invite.last_name,
          email: invite.email,
          phone: invite.phone,
          is_active: false
        }
      })) || [];

      return [...activeDrivers, ...pendingDrivers];
    },
    enabled: !!profile?.company_id,
    refetchInterval: 30000 // Refresh every 30 seconds for real-time updates
  });

  // Fetch available vans for assignment
  const { data: vans = [] } = useQuery({
    queryKey: ['vans', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      
      const { data, error } = await supabase
        .from('vans')
        .select('id, registration, make, model, is_active')
        .eq('company_id', profile.company_id)
        .eq('is_active', true)
        .order('registration');

      if (error) throw error;
      return data;
    },
    enabled: !!profile?.company_id
  });

  // Set initial filtered data when drivers change
  React.useEffect(() => {
    if (drivers && drivers !== filteredDrivers) {
      setFilteredDrivers(drivers);
    }
  }, [drivers]);

  // Real-time form validation
  const validateField = (field: string, value: string) => {
    const fieldSchema = {
      email: emailSchema,
      firstName: nameSchema,
      lastName: nameSchema,
      phone: phoneSchema,
      parcelRate: parcelRateSchema,
      coverRate: parcelRateSchema
    }[field];

    if (fieldSchema) {
      try {
        fieldSchema.parse(value);
        setFormErrors(prev => ({ ...prev, [field]: '' }));
      } catch (error) {
        if (error instanceof z.ZodError) {
          setFormErrors(prev => ({ ...prev, [field]: error.errors[0].message }));
        }
      }
    }
  };

  // Invite driver mutation with enhanced security
  const inviteDriverMutation = useMutation({
    mutationFn: async (driverData: typeof formData) => {
      // Validate all form data
      const validation = validateForm(driverData, driverInviteSchema);
      if (!validation.success) {
        setFormErrors(validation.errors || {});
        setShowFormErrors(true);
        throw new Error('Please fix the form errors before submitting');
      }

      // Sanitize inputs
      const sanitizedData = {
        email: sanitizeInput(driverData.email),
        firstName: sanitizeInput(driverData.firstName),
        lastName: sanitizeInput(driverData.lastName),
        phone: sanitizeInput(driverData.phone),
        parcelRate: driverData.parcelRate
      };

      // Get fresh profile data
      const { data: freshProfile, error: profileError } = await supabase
        .from('profiles')
        .select('company_id, user_id')
        .eq('user_id', profile?.user_id)
        .maybeSingle();

      if (profileError) {
        throw new Error('Failed to fetch profile data: ' + profileError.message);
      }

      const companyId = freshProfile?.company_id || profile?.company_id;
      if (!companyId) {
        throw new Error('No company assigned to your profile. Please contact support.');
      }

      // Check for duplicate driver profile (not just email)
      const { data: existingDriverProfile } = await supabase
        .from('driver_profiles')
        .select('id, user_id')
        .eq('company_id', companyId)
        .limit(1);

      // Check if any existing driver has this email
      if (existingDriverProfile && existingDriverProfile.length > 0) {
        const userIds = existingDriverProfile.map(d => d.user_id);
        const { data: profilesWithEmail } = await supabase
          .from('profiles')
          .select('user_id')
          .eq('email', sanitizedData.email)
          .in('user_id', userIds);

        if (profilesWithEmail && profilesWithEmail.length > 0) {
          throw new Error('A driver with this email already exists in your company');
        }
      }

      const { data, error } = await supabase.functions.invoke('secure-staff-invite', {
        body: {
          ...sanitizedData,
          companyId: companyId
        }
      });

      if (error) {
        console.error('Supabase function error:', error);
        throw new Error(`Invitation failed: ${error.message || 'Edge Function returned a non-2xx status code'}`);
      }

      if (!data?.success) {
        console.error('Function returned error:', data);
        throw new Error(data?.message || data?.error || 'Failed to send invitation');
      }

      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "🎉 Driver invited successfully!",
        description: `${formData.firstName} ${formData.lastName} will receive an onboarding email. The invitation expires in 7 days.`,
      });
      setIsDialogOpen(false);
      setFormData({
        email: '',
        firstName: '',
        lastName: '',
        phone: '',
        parcelRate: '',
        coverRate: ''
      });
      setFormErrors({});
      setShowFormErrors(false);
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
    },
    onError: (error: any) => {
      console.error('Invitation error:', error);
      
      // Parse error response for better user feedback
      let errorMessage = error.message || 'Failed to send invitation';
      let errorTitle = 'Error inviting driver';
      
      if (error.message?.includes('already exists')) {
        errorTitle = 'Duplicate invitation';
        errorMessage = error.message;
      } else if (error.message?.includes('Invalid') || error.message?.includes('validation')) {
        errorTitle = 'Invalid information';
        errorMessage = error.message;
      } else if (error.message?.includes('Email delivery failed')) {
        errorTitle = 'Email delivery failed';
        errorMessage = 'Please check the email address and try again.';
      } else if (error.message?.includes('Configuration error')) {
        errorTitle = 'System error';
        errorMessage = 'Please contact support - system configuration issue.';
      }

      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Delete driver mutation with comprehensive cleanup
  const deleteDriverMutation = useMutation({
    mutationFn: async (driverId: string) => {
      const { data: driverProfile, error: fetchError } = await supabase
        .from('driver_profiles')
        .select('user_id, status, profiles!inner(first_name, last_name)')
        .eq('id', driverId)
        .single();

      if (fetchError) throw fetchError;

      // Use edge function for proper cleanup
      const { data, error } = await supabase.functions.invoke('remove-driver', {
        body: {
          driverId: driverId,
          cleanupUser: driverProfile.status === 'pending' // Clean up user account for pending invites
        }
      });

      if (error) {
        throw new Error(`Failed to remove driver: ${error.message || 'Unknown error'}`);
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to remove driver');
      }

      return data;
    },
    onSuccess: (data) => {
      const message = data.cleanedUp 
        ? "Driver removed and account cleaned up successfully"
        : "Driver removed successfully";
      
      toast({
        title: "Driver removed successfully",
        description: message,
      });
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error removing driver",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Cancel invitation mutation
  const cancelInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const { error } = await supabase
        .from('driver_invitations')
        .update({ status: 'cancelled' })
        .eq('id', invitationId);

      if (error) throw error;
      return invitationId;
    },
    onSuccess: () => {
      toast({
        title: "Invitation cancelled",
        description: "The driver invitation has been cancelled successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error cancelling invitation",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update driver mutation
  const updateDriverMutation = useMutation({
    mutationFn: async ({ driverId, updates }: { driverId: string, updates: any }) => {
      // Update driver profile
      const { error: driverError } = await supabase
        .from('driver_profiles')
        .update({
          
          parcel_rate: updates.parcelRate ? parseFloat(updates.parcelRate) : null,
          cover_rate: updates.coverRate ? parseFloat(updates.coverRate) : null,
          status: updates.status,
          assigned_van_id: updates.assignedVanId || null,
        })
        .eq('id', driverId);

      if (driverError) throw driverError;

      // Update user profile
      const driver = drivers.find(d => d.id === driverId);
      if (driver?.user_id) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            first_name: updates.firstName,
            last_name: updates.lastName,
            phone: updates.phone,
          })
          .eq('user_id', driver.user_id);

        if (profileError) throw profileError;
      }

      return { driverId, updates };
    },
    onSuccess: () => {
      toast({
        title: "Driver updated",
        description: "Driver profile has been updated successfully.",
      });
      setIsEditDialogOpen(false);
      setSelectedDriver(null);
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating driver",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (showFormErrors) {
      validateField(field, value);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowFormErrors(true);
    inviteDriverMutation.mutate(formData);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedDriver) {
      updateDriverMutation.mutate({
        driverId: selectedDriver.id,
        updates: editFormData
      });
    }
  };

  const openEditDialog = (driver: any) => {
    setSelectedDriver(driver);
    setEditFormData({
      firstName: driver.profiles?.first_name || '',
      lastName: driver.profiles?.last_name || '',
      phone: driver.profiles?.phone || '',
      
      parcelRate: driver.parcel_rate?.toString() || '',
      coverRate: driver.cover_rate?.toString() || '',
      status: driver.status || 'pending',
      assignedVanId: driver.assigned_van_id || ''
    });
    setIsEditDialogOpen(true);
  };

  const toggleDocumentView = (driverId: string) => {
    setShowDocuments(prev => ({
      ...prev,
      [driverId]: !prev[driverId]
    }));
  };

  // Statistics
  const stats = useMemo(() => {
    const total = drivers.length;
    const active = drivers.filter(d => d.status === 'active').length;
    const pending = drivers.filter(d => d.status === 'pending').length;
    const inactive = drivers.filter(d => d.status === 'inactive').length;
    
    return { total, active, pending, inactive };
  }, [drivers]);

  if (isLoading) {
    return (
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-background">
          <AppSidebar />
          <SidebarInset className="flex-1">
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p>Loading driver data...</p>
                <Progress value={66} className="w-48" />
              </div>
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    );
  }

  if (error) {
    return (
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-background">
          <AppSidebar />
          <SidebarInset className="flex-1 p-6">
            <Alert className="max-w-md mx-auto mt-20">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Failed to load driver data. Please refresh the page or contact support.
              </AlertDescription>
            </Alert>
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
              <div className="flex-1">
                <h1 className="text-xl font-semibold text-foreground">Driver Management</h1>
                <p className="text-sm text-muted-foreground">
                  Manage your driver workforce • {stats.total} total drivers
                </p>
              </div>
              <div className="flex items-center space-x-4 text-sm">
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>{stats.active} Active</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                  <span>{stats.pending} Pending</span>
                </div>
              </div>
            </div>
          </header>

          <main className="p-6 space-y-6">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <h2 className="text-2xl font-bold">Team Overview</h2>
                <p className="text-muted-foreground">Manage drivers and track their status</p>
              </div>
        
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="shrink-0">
                    <Plus className="h-4 w-4 mr-2" />
                    Invite Driver
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Invite New Driver</DialogTitle>
                    <DialogDescription>
                      Add a new driver to your team. They will receive login credentials via email.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="firstName">First Name <span className="text-destructive">*</span></Label>
                        <Input
                          id="firstName"
                          value={formData.firstName}
                          onChange={(e) => handleInputChange('firstName', e.target.value)}
                          className={formErrors.firstName ? 'border-destructive' : ''}
                          required
                          aria-describedby={formErrors.firstName ? 'firstName-error' : undefined}
                        />
                        {formErrors.firstName && (
                          <p id="firstName-error" className="text-sm text-destructive mt-1">
                            {formErrors.firstName}
                          </p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="lastName">Last Name <span className="text-destructive">*</span></Label>
                        <Input
                          id="lastName"
                          value={formData.lastName}
                          onChange={(e) => handleInputChange('lastName', e.target.value)}
                          className={formErrors.lastName ? 'border-destructive' : ''}
                          required
                          aria-describedby={formErrors.lastName ? 'lastName-error' : undefined}
                        />
                        {formErrors.lastName && (
                          <p id="lastName-error" className="text-sm text-destructive mt-1">
                            {formErrors.lastName}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="email">Email Address <span className="text-destructive">*</span></Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        className={formErrors.email ? 'border-destructive' : ''}
                        required
                        aria-describedby={formErrors.email ? 'email-error' : undefined}
                      />
                      {formErrors.email && (
                        <p id="email-error" className="text-sm text-destructive mt-1">
                          {formErrors.email}
                        </p>
                      )}
                    </div>
                    
                    <div>
                      <Label htmlFor="phone">Mobile Number</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => handleInputChange('phone', e.target.value)}
                        className={formErrors.phone ? 'border-destructive' : ''}
                        placeholder="+44 123 456 7890"
                        aria-describedby={formErrors.phone ? 'phone-error' : undefined}
                      />
                      {formErrors.phone && (
                        <p id="phone-error" className="text-sm text-destructive mt-1">
                          {formErrors.phone}
                        </p>
                      )}
                    </div>
                    
                    <div>
                       <Label htmlFor="parcelRate">Base Parcel Rate (£)</Label>
                       <Input
                         id="parcelRate"
                         type="number"
                         step="0.01"
                         min="0"
                         max="100"
                         value={formData.parcelRate}
                         onChange={(e) => handleInputChange('parcelRate', e.target.value)}
                         placeholder="Enter base parcel rate"
                         aria-describedby={formErrors.parcelRate ? 'parcelRate-error' : undefined}
                       />
                       {formErrors.parcelRate && (
                         <p id="parcelRate-error" className="text-sm text-destructive mt-1">
                           {formErrors.parcelRate}
                         </p>
                       )}
                     </div>
                     <div>
                       <Label htmlFor="coverRate">Cover Parcel Rate (£)</Label>
                       <Input
                         id="coverRate"
                         type="number"
                         step="0.01"
                         min="0"
                         max="100"
                         value={formData.coverRate}
                         onChange={(e) => handleInputChange('coverRate', e.target.value)}
                         placeholder="Enter cover parcel rate"
                         aria-describedby={formErrors.coverRate ? 'coverRate-error' : undefined}
                       />
                       {formErrors.coverRate && (
                         <p id="coverRate-error" className="text-sm text-destructive mt-1">
                           {formErrors.coverRate}
                         </p>
                       )}
                    </div>
                    
                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={inviteDriverMutation.isPending}
                    >
                      {inviteDriverMutation.isPending ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                          Sending Invite...
                        </>
                      ) : (
                        <>
                          <Mail className="h-4 w-4 mr-2" />
                          Send Invite
                        </>
                      )}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
              
              {/* Edit Driver Dialog */}
              <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>Edit Driver Profile</DialogTitle>
                    <DialogDescription>
                      Update driver information and assignments.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleEditSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="editFirstName">First Name</Label>
                        <Input
                          id="editFirstName"
                          value={editFormData.firstName}
                          onChange={(e) => setEditFormData(prev => ({ ...prev, firstName: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="editLastName">Last Name</Label>
                        <Input
                          id="editLastName"
                          value={editFormData.lastName}
                          onChange={(e) => setEditFormData(prev => ({ ...prev, lastName: e.target.value }))}
                        />
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="editPhone">Mobile Number</Label>
                      <Input
                        id="editPhone"
                        type="tel"
                        value={editFormData.phone}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="+44 123 456 7890"
                      />
                    </div>
                    
                     <div className="grid grid-cols-2 gap-4">
                       <div>
                         <Label htmlFor="editParcelRate">Base Parcel Rate (£)</Label>
                         <Input
                           id="editParcelRate"
                           type="number"
                           step="0.01"
                           min="0"
                           max="100"
                           value={editFormData.parcelRate}
                           onChange={(e) => setEditFormData(prev => ({ ...prev, parcelRate: e.target.value }))}
                           placeholder="Enter base parcel rate"
                         />
                       </div>
                       <div>
                         <Label htmlFor="editCoverRate">Cover Parcel Rate (£)</Label>
                         <Input
                           id="editCoverRate"
                           type="number"
                           step="0.01"
                           min="0"
                           max="100"
                           value={editFormData.coverRate}
                           onChange={(e) => setEditFormData(prev => ({ ...prev, coverRate: e.target.value }))}
                           placeholder="Enter cover parcel rate"
                         />
                       </div>
                     </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="editStatus">Status</Label>
                        <Select 
                          value={editFormData.status} 
                          onValueChange={(value) => setEditFormData(prev => ({ ...prev, status: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="pending">Pending Setup</SelectItem>
                            <SelectItem value="inactive">Inactive</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="editVan">Assigned Van</Label>
                        <Select 
                          value={editFormData.assignedVanId} 
                          onValueChange={(value) => setEditFormData(prev => ({ ...prev, assignedVanId: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select van" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">No assignment</SelectItem>
                            {vans.map((van) => (
                              <SelectItem key={van.id} value={van.id}>
                                {van.registration} - {van.make} {van.model}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="flex space-x-2">
                      <Button 
                        type="submit" 
                        className="flex-1" 
                        disabled={updateDriverMutation.isPending}
                      >
                        {updateDriverMutation.isPending ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                            Updating...
                          </>
                        ) : (
                          <>
                            <Edit className="h-4 w-4 mr-2" />
                            Update Driver
                          </>
                        )}
                      </Button>
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => setIsEditDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {/* Smart Search */}
            <SmartSearch
              data={drivers}
              searchFields={['profiles.first_name', 'profiles.last_name', 'profiles.email', 'profiles.phone']}
              onFilter={setFilteredDrivers}
              placeholder="Search drivers by name, email, or phone..."
              filterOptions={[
                {
                  label: 'Status',
                  field: 'status',
                  options: [
                    { value: 'active', label: 'Active' },
                    { value: 'pending', label: 'Pending Setup' },
                    { value: 'inactive', label: 'Inactive' }
                  ]
                }
              ]}
            />

            <Card>
              <CardHeader>
                <CardTitle>Driver Workforce</CardTitle>
                <CardDescription>
                  {filteredDrivers.length} of {drivers.length} drivers shown
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead className="hidden sm:table-cell">Mobile</TableHead>
                        <TableHead className="hidden md:table-cell">Rate</TableHead>
                        <TableHead className="hidden lg:table-cell">Van</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDrivers.map((driver) => (
                        <React.Fragment key={driver.id}>
                          <TableRow>
                            <TableCell className="font-medium">
                              <div>
                                <div className="flex items-center space-x-2">
                                  <span>{driver.profiles?.first_name} {driver.profiles?.last_name}</span>
                                  {driver.type === 'invitation' && (
                                    <Badge variant="outline" className="text-xs">
                                      Pending Invite
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground sm:hidden">
                                  {driver.profiles?.email}
                                </div>
                                {driver.type === 'invitation' && driver.expires_at && (
                                  <div className="text-xs text-orange-600">
                                    Expires: {new Date(driver.expires_at).toLocaleDateString()}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              {driver.profiles?.email}
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              {driver.profiles?.phone || '-'}
                            </TableCell>
                             <TableCell className="hidden md:table-cell">
                               <div className="text-sm">
                                 Base: {driver.parcel_rate ? `£${driver.parcel_rate}` : '-'}/parcel
                                 <br />
                                 Cover: {driver.cover_rate ? `£${driver.cover_rate}` : '-'}/parcel
                               </div>
                             </TableCell>
                            <TableCell className="hidden lg:table-cell">
                              {driver.assigned_van ? (
                                <Badge variant="outline" className="text-xs">
                                  <Truck className="h-3 w-3 mr-1" />
                                  {driver.assigned_van.registration}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-sm">Unassigned</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <Badge variant={
                                  driver.type === 'invitation' ? 'secondary' :
                                  driver.status === 'active' ? 'default' : 
                                  driver.status === 'pending' ? 'secondary' : 
                                  'outline'
                                }>
                                  {driver.type === 'invitation' && (
                                    <>
                                      <Clock className="h-3 w-3 mr-1" />
                                      Invited
                                    </>
                                  )}
                                  {driver.type === 'active' && driver.status === 'active' && (
                                    <>
                                      <UserCheck className="h-3 w-3 mr-1" />
                                      Active
                                    </>
                                  )}
                                  {driver.type === 'active' && driver.status === 'pending' && (
                                    <>
                                      <Clock className="h-3 w-3 mr-1" />
                                      Setup Required
                                    </>
                                  )}
                                  {driver.type === 'active' && driver.status === 'inactive' && (
                                    <>
                                      <UserX className="h-3 w-3 mr-1" />
                                      Inactive
                                    </>
                                  )}
                                </Badge>
                                {driver.type === 'active' && !driver.onboarding_completed_at && (
                                  <Badge variant="outline" className="text-xs">
                                    Onboarding
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex space-x-1">
                                {driver.type === 'active' && (
                                  <>
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      title="Edit driver"
                                      onClick={() => openEditDialog(driver)}
                                    >
                                      <Edit className="h-3 w-3" />
                                    </Button>
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      title="View documents"
                                      onClick={() => toggleDocumentView(driver.id)}
                                    >
                                      {showDocuments[driver.id] ? (
                                        <EyeOff className="h-3 w-3" />
                                      ) : (
                                        <FileText className="h-3 w-3" />
                                      )}
                                    </Button>
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      title="Call driver"
                                      onClick={() => driver.profiles?.phone && window.open(`tel:${driver.profiles.phone}`)}
                                      disabled={!driver.profiles?.phone}
                                    >
                                      <Phone className="h-3 w-3" />
                                    </Button>
                                  </>
                                )}
                                <ConfirmDelete
                                  title={
                                    driver.type === 'invitation' 
                                      ? `Cancel invitation for ${driver.profiles?.first_name} ${driver.profiles?.last_name}?`
                                      : `Remove ${driver.profiles?.first_name} ${driver.profiles?.last_name}?`
                                  }
                                  description={
                                    driver.type === 'invitation'
                                      ? "This will cancel the pending invitation and remove it from your list."
                                      : driver.status === 'pending' 
                                        ? "This will cancel the pending setup and remove the driver profile."
                                        : "This will permanently remove the driver from your team. This action cannot be undone."
                                  }
                                  onConfirm={() => {
                                    if (driver.type === 'invitation') {
                                      // Handle invitation cancellation
                                      cancelInvitationMutation.mutate(driver.id);
                                    } else {
                                      // Handle driver removal
                                      deleteDriverMutation.mutate(driver.id);
                                    }
                                  }}
                                  disabled={deleteDriverMutation.isPending || cancelInvitationMutation.isPending}
                                />
                              </div>
                            </TableCell>
                          </TableRow>
                          
                          {/* Document viewer row */}
                          {driver.type === 'active' && showDocuments[driver.id] && (
                            <TableRow>
                              <TableCell colSpan={7} className="bg-muted/30">
                                <div className="py-4 space-y-4">
                                  <h4 className="font-medium">Driver Documents</h4>
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                      <Label className="text-sm font-medium">Driving License</Label>
                                      {driver.driving_license_document ? (
                                        <div className="flex items-center space-x-2">
                                          <Badge variant="outline" className="text-green-600">
                                            <FileText className="h-3 w-3 mr-1" />
                                            Uploaded
                                          </Badge>
                                          <Button 
                                            variant="link" 
                                            size="sm"
                                            onClick={() => window.open(driver.driving_license_document, '_blank')}
                                          >
                                            View
                                          </Button>
                                        </div>
                                      ) : (
                                        <Badge variant="outline" className="text-muted-foreground">
                                          Not uploaded
                                        </Badge>
                                      )}
                                    </div>
                                    
                                    <div className="space-y-2">
                                      <Label className="text-sm font-medium">Insurance Document</Label>
                                      {driver.insurance_document ? (
                                        <div className="flex items-center space-x-2">
                                          <Badge variant="outline" className="text-green-600">
                                            <FileText className="h-3 w-3 mr-1" />
                                            Uploaded
                                          </Badge>
                                          <Button 
                                            variant="link" 
                                            size="sm"
                                            onClick={() => window.open(driver.insurance_document, '_blank')}
                                          >
                                            View
                                          </Button>
                                        </div>
                                      ) : (
                                        <Badge variant="outline" className="text-muted-foreground">
                                          Not uploaded
                                        </Badge>
                                      )}
                                    </div>
                                    
                                    <div className="space-y-2">
                                      <Label className="text-sm font-medium">Right to Work</Label>
                                      {driver.right_to_work_document ? (
                                        <div className="flex items-center space-x-2">
                                          <Badge variant="outline" className="text-green-600">
                                            <FileText className="h-3 w-3 mr-1" />
                                            Uploaded
                                          </Badge>
                                          <Button 
                                            variant="link" 
                                            size="sm"
                                            onClick={() => window.open(driver.right_to_work_document, '_blank')}
                                          >
                                            View
                                          </Button>
                                        </div>
                                      ) : (
                                        <Badge variant="outline" className="text-muted-foreground">
                                          Not uploaded
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                  
                                  {driver.driving_license_number && (
                                    <div className="mt-4 p-3 bg-background rounded-lg">
                                      <Label className="text-sm font-medium">License Details</Label>
                                      <div className="text-sm text-muted-foreground mt-1">
                                        <p>License Number: {driver.driving_license_number}</p>
                                        {driver.license_expiry && (
                                          <p>Expires: {new Date(driver.license_expiry).toLocaleDateString()}</p>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                
                {filteredDrivers.length === 0 && drivers.length > 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No drivers match your search criteria.
                  </div>
                )}
                
                {drivers.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <UserX className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-medium mb-2">No drivers yet</h3>
                    <p>Start by inviting your first driver to the team.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default DriverManagement;