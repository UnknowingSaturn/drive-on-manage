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
import { Plus, Mail, Phone, UserCheck, UserX, Edit, Trash2, Clock, AlertCircle, Eye, EyeOff, FileText, Truck, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { ConfirmDelete } from '@/components/ConfirmDelete';
import { DriverDetailsModal } from '@/components/DriverDetailsModal';
import { SmartSearch } from '@/components/SmartSearch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import UserInviteModal from '@/components/UserInviteModal';
import TeamManagement from '@/components/TeamManagement';

import { Progress } from '@/components/ui/progress';
import { validateForm, sanitizeInput, emailSchema, nameSchema, phoneSchema, parcelRateSchema } from '@/lib/security';
import { format } from 'date-fns';
import { z } from 'zod';

// Validation schema for driver creation
const driverCreateSchema = z.object({
  email: emailSchema,
  firstName: nameSchema,
  lastName: nameSchema,
  phone: phoneSchema.optional(),
  parcelRate: z.string().optional(),
  coverRate: z.string().optional()
});

const DriverManagement = () => {
  const { profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
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
    coverRate: '',
    companyId: ''
  });
  const [editFormData, setEditFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    parcelRate: '',
    coverRate: ''
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [editFormErrors, setEditFormErrors] = useState<Record<string, string>>({});

  // Refresh profile on component mount to ensure latest data
  React.useEffect(() => {
    refreshProfile();
  }, []);

  // Fetch drivers for the companies the user has access to
  const { data: drivers = [], isLoading, error } = useQuery({
    queryKey: ['drivers', profile?.user_companies],
    queryFn: async () => {
      if (!profile?.user_companies?.length) {
        
        return [];
      }
      
      const companyIds = profile.user_companies.map(uc => uc.company_id);
      
      
      // Use the new database function to get drivers with their profile information
      const { data: driversWithProfiles, error: driversError } = await supabase
        .rpc('get_drivers_with_profiles', { 
          company_ids: companyIds 
        });

      if (driversError) {
        
        return [];
      }

      

      // Fetch van information for assigned vans
      const vanIds = driversWithProfiles
        ?.filter(driver => driver.assigned_van_id)
        .map(driver => driver.assigned_van_id) || [];

      let vansData = [];
      if (vanIds.length > 0) {
        const { data: vans, error: vansError } = await supabase
          .from('vans')
          .select('id, registration, make, model')
          .in('id', vanIds);

        if (vansError) {
          
        } else {
          vansData = vans || [];
        }
      }

      // Transform the data for the UI
      return (driversWithProfiles || []).map((driver: any) => {
        const assignedVan = driver.assigned_van_id 
          ? vansData.find(van => van.id === driver.assigned_van_id)
          : null;

        return {
          ...driver,
          type: 'active' as const,
          name: `${driver.first_name || ''} ${driver.last_name || ''}`.trim() || 'Unknown',
          email: driver.email || 'No email',
          phone: driver.phone || '',
          isActive: driver.is_active ?? true,
          status: driver.first_login_completed ? 'active' : 'pending_first_login',
          onboardingCompletedAt: driver.onboarding_completed_at,
          assigned_van: assignedVan
        };
      });
    },
    enabled: !!profile?.user_companies?.length,
    refetchInterval: 30000 // Refresh every 30 seconds for real-time updates
  });

  // Fetch available companies
  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data;
    }
  });

  // Fetch available vans for assignment from all user's companies
  const { data: vans = [] } = useQuery({
    queryKey: ['vans', profile?.user_companies],
    queryFn: async () => {
      if (!profile?.user_companies?.length) return [];
      
      const companyIds = profile.user_companies.map((uc: any) => uc.company_id);
      
      const { data, error } = await supabase
        .from('vans')
        .select('id, registration, make, model, is_active')
        .in('company_id', companyIds)
        .eq('is_active', true)
        .order('registration');

      if (error) throw error;
      return data;
    },
    enabled: !!profile?.user_companies?.length
  });

  // Set initial filtered data when drivers change
  React.useEffect(() => {
    if (drivers && drivers !== filteredDrivers) {
      setFilteredDrivers(drivers);
    }
  }, [drivers]);

  // Real-time subscriptions for driver and van updates
  React.useEffect(() => {
    const driverProfilesChannel = supabase
      .channel('driver_profiles_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'driver_profiles'
        },
        (payload) => {
          
          queryClient.invalidateQueries({ queryKey: ['drivers'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vans'
        },
        (payload) => {
          
          queryClient.invalidateQueries({ queryKey: ['drivers'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(driverProfilesChannel);
    };
  }, [queryClient]);

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

  // Simplified create driver mutation
  const createDriverMutation = useMutation({
    mutationFn: async (driverData: typeof formData) => {
      
      
      // Basic validation
      if (!driverData.email || !driverData.firstName || !driverData.lastName || !driverData.companyId) {
        throw new Error('Please fill in all required fields including company selection');
      }

      const companyId = driverData.companyId;
      
      if (!companyId) {
        throw new Error('Please select a company for the driver');
      }

      // Check for duplicate email
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', driverData.email)
        .maybeSingle();

      if (existingProfile) {
        throw new Error('A user with this email already exists in your company');
      }

      // Step 1: Create everything via comprehensive edge function
      
      const { data: createResult, error: createError } = await supabase.functions.invoke('comprehensive-create-driver', {
        body: {
          email: driverData.email.trim(),
          firstName: driverData.firstName.trim(),
          lastName: driverData.lastName.trim(),
          phone: driverData.phone?.trim() || null,
          companyId: companyId,
          parcelRate: parseFloat(driverData.parcelRate) || 0.75,
          coverRate: parseFloat(driverData.coverRate) || 1.0
        }
      });

      

      if (createError || !createResult?.success) {
        throw new Error(createError?.message || 'Failed to create driver account');
      }

      

      // Step 2: Send credentials email
      const { error: emailError } = await supabase.functions.invoke('send-driver-credentials', {
        body: {
          email: driverData.email,
          firstName: driverData.firstName,
          lastName: driverData.lastName,
          tempPassword: createResult.tempPassword,
          companyId: companyId
        }
      });

      if (emailError) {
        
        // Don't fail the whole operation for email issues
      }

      return {
        userId: createResult.userId,
        tempPassword: createResult.tempPassword,
        success: true
      };
    },
    onSuccess: (data) => {
      
      toast({
        title: "Driver Created Successfully",
        description: `${formData.firstName} ${formData.lastName} has been added as a driver. Login credentials have been sent to ${formData.email}.`,
      });
      
      setIsDialogOpen(false);
      setFormData({
        email: '',
        firstName: '',
        lastName: '',
        phone: '',
        parcelRate: '',
        coverRate: '',
        companyId: ''
      });
      setFormErrors({});
      setShowFormErrors(false);
      
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
    },
    onError: (error: any) => {
      
      
      // Parse error response for better user feedback
      let errorMessage = error.message || 'Failed to create driver';
      let errorTitle = 'Error creating driver';
      
      if (error.message?.includes('already exists')) {
        errorTitle = 'Duplicate driver';
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
    }
  });

  // Delete driver mutation with comprehensive edge function
  const deleteDriverMutation = useMutation({
    mutationFn: async (driverId: string) => {
      const companyId = profile?.user_companies?.[0]?.company_id;
      
      // Call the new comprehensive delete-driver function
      const { data, error } = await supabase.functions.invoke('delete-driver-comprehensive', {
        body: {
          driverId: driverId,
          companyId: companyId
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
      const deletedCount = Object.values(data.deletedRecords || {}).reduce((sum: number, count: number) => sum + count, 0);
      toast({
        title: "Driver removed successfully",
        description: `Driver account and ${deletedCount} related records have been removed. ${data.authUserDeleted ? 'User account also deleted.' : 'User account preserved.'}`,
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

  // Update driver mutation - only personal details
  const updateDriverMutation = useMutation({
    mutationFn: async ({ driverId, updates }: { driverId: string, updates: any }) => {
      // Update driver profile (only rates)
      const { error: driverError } = await supabase
        .from('driver_profiles')
        .update({
          parcel_rate: updates.parcelRate ? parseFloat(updates.parcelRate) : null,
          cover_rate: updates.coverRate ? parseFloat(updates.coverRate) : null,
        })
        .eq('id', driverId);

      if (driverError) throw driverError;

      // Update user profile (only personal details)
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
    createDriverMutation.mutate(formData);
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
      firstName: driver.first_name || '',
      lastName: driver.last_name || '',
      phone: driver.phone || '',
      parcelRate: driver.parcel_rate?.toString() || '',
      coverRate: driver.cover_rate?.toString() || ''
    });
    setIsEditDialogOpen(true);
  };

  const openDetailsModal = (driver: any) => {
    setSelectedDriver(driver);
    setIsDetailsModalOpen(true);
  };

  const toggleDocumentView = (driverId: string) => {
    setShowDocuments(prev => ({ ...prev, [driverId]: !prev[driverId] }));
  };

  // Calculate statistics
  const stats = useMemo(() => {
    const totalDrivers = drivers.length;
    const activeDrivers = drivers.filter(d => d.status === 'active').length;
    const pendingDrivers = drivers.filter(d => d.status === 'pending_first_login').length;
    const withVans = drivers.filter(d => d.assigned_van_id).length;

    return {
      total: totalDrivers,
      active: activeDrivers,
      pending: pendingDrivers,
      withVans,
      withoutVans: totalDrivers - withVans
    };
  }, [drivers]);

  if (isLoading) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
            <div className="min-h-[100vh] flex-1 rounded-xl bg-muted/50 md:min-h-min" />
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  if (error) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Failed to load drivers: {error.message}
              </AlertDescription>
            </Alert>
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Driver Management</h1>
                <p className="text-muted-foreground">
                  Manage your company's drivers and their assignments
                </p>
              </div>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Driver
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Create New Driver</DialogTitle>
                    <DialogDescription>
                      Enter driver details. They will receive login credentials via email.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="firstName">First Name *</Label>
                        <Input
                          id="firstName"
                          value={formData.firstName}
                          onChange={(e) => handleInputChange('firstName', e.target.value)}
                          className={formErrors.firstName ? 'border-red-500' : ''}
                        />
                        {formErrors.firstName && (
                          <span className="text-sm text-red-500">{formErrors.firstName}</span>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName">Last Name *</Label>
                        <Input
                          id="lastName"
                          value={formData.lastName}
                          onChange={(e) => handleInputChange('lastName', e.target.value)}
                          className={formErrors.lastName ? 'border-red-500' : ''}
                        />
                        {formErrors.lastName && (
                          <span className="text-sm text-red-500">{formErrors.lastName}</span>
                        )}
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        className={formErrors.email ? 'border-red-500' : ''}
                      />
                      {formErrors.email && (
                        <span className="text-sm text-red-500">{formErrors.email}</span>
                      )}
                    </div>
                    
                     <div className="space-y-2">
                       <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => handleInputChange('phone', e.target.value)}
                        className={formErrors.phone ? 'border-red-500' : ''}
                      />
                      {formErrors.phone && (
                        <span className="text-sm text-red-500">{formErrors.phone}</span>
                      )}
                     </div>
                     
                     <div className="space-y-2">
                       <Label htmlFor="companyId">Company *</Label>
                       <Select
                         value={formData.companyId}
                         onValueChange={(value) => handleInputChange('companyId', value)}
                       >
                         <SelectTrigger>
                           <SelectValue placeholder="Select company" />
                         </SelectTrigger>
                         <SelectContent>
                           {companies.map((company) => (
                             <SelectItem key={company.id} value={company.id}>
                               {company.name}
                             </SelectItem>
                           ))}
                         </SelectContent>
                       </Select>
                       {formErrors.companyId && (
                         <span className="text-sm text-red-500">{formErrors.companyId}</span>
                       )}
                     </div>
                     
                     <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="parcelRate">Parcel Rate (£)</Label>
                        <Input
                          id="parcelRate"
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.parcelRate}
                          onChange={(e) => handleInputChange('parcelRate', e.target.value)}
                          placeholder="0.75"
                          className={formErrors.parcelRate ? 'border-red-500' : ''}
                        />
                        {formErrors.parcelRate && (
                          <span className="text-sm text-red-500">{formErrors.parcelRate}</span>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="coverRate">Cover Rate (£)</Label>
                        <Input
                          id="coverRate"
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.coverRate}
                          onChange={(e) => handleInputChange('coverRate', e.target.value)}
                          placeholder="1.00"
                          className={formErrors.coverRate ? 'border-red-500' : ''}
                        />
                        {formErrors.coverRate && (
                          <span className="text-sm text-red-500">{formErrors.coverRate}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-end space-x-2">
                      <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button 
                        type="submit" 
                        disabled={createDriverMutation.isPending}
                      >
                        {createDriverMutation.isPending ? 'Creating...' : 'Create Driver'}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {/* Statistics Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Drivers</CardTitle>
                  <UserCheck className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.total}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Drivers</CardTitle>
                  <UserCheck className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{stats.active}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pending Login</CardTitle>
                  <Clock className="h-4 w-4 text-yellow-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">With Vans</CardTitle>
                  <Truck className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">{stats.withVans}</div>
                </CardContent>
              </Card>
            </div>

            {/* Search and Filter */}
            <Card>
              <CardContent className="p-6">
                <SmartSearch
                  data={drivers}
                  onFilter={setFilteredDrivers}
                  searchFields={['name', 'email', 'phone']}
                  placeholder="Search drivers by name, email, or phone..."
                />
              </CardContent>
            </Card>

            {/* Drivers Table */}
            <Card>
              <CardHeader>
                <CardTitle>Drivers ({filteredDrivers.length})</CardTitle>
                <CardDescription>
                  Manage your company's drivers and their details
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Driver</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Rates</TableHead>
                        <TableHead>Van Assignment</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDrivers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8">
                            <div className="flex flex-col items-center space-y-2">
                              <UserX className="h-8 w-8 text-muted-foreground" />
                              <p className="text-muted-foreground">No drivers found</p>
                              <p className="text-sm text-muted-foreground">
                                Create your first driver to get started
                              </p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredDrivers.map((driver) => (
                          <React.Fragment key={driver.id}>
                            <TableRow>
                              <TableCell>
                                <div className="flex flex-col">
                                  <span className="font-medium">{driver.name}</span>
                                  {driver.driving_license_number && (
                                    <span className="text-sm text-muted-foreground">
                                      License: {driver.driving_license_number}
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col space-y-1">
                                  <div className="flex items-center space-x-2">
                                    <Mail className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-sm">{driver.email}</span>
                                  </div>
                                  {driver.phone && (
                                    <div className="flex items-center space-x-2">
                                      <Phone className="h-3 w-3 text-muted-foreground" />
                                      <span className="text-sm">{driver.phone}</span>
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col space-y-1">
                                  {driver.parcel_rate && (
                                    <span className="text-sm">£{driver.parcel_rate}/parcel</span>
                                  )}
                                  {driver.cover_rate && (
                                    <span className="text-sm text-muted-foreground">
                                      Cover: £{driver.cover_rate}
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                {driver.assigned_van ? (
                                  <div className="flex items-center space-x-2">
                                    <Truck className="h-4 w-4 text-blue-600" />
                                    <span className="text-sm">
                                      {driver.assigned_van.registration}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-sm text-muted-foreground">No van assigned</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge variant={
                                  driver.status === 'active' ? 'default' :
                                  driver.status === 'pending_first_login' ? 'secondary' : 'outline'
                                }>
                                  {driver.status === 'active' ? 'Active' :
                                   driver.status === 'pending_first_login' ? 'Pending Login' : 
                                   driver.status}
                                </Badge>
                              </TableCell>
                               <TableCell>
                                 <div className="flex items-center space-x-2">
                                   <Button
                                     variant="outline"
                                     size="sm"
                                     onClick={() => openDetailsModal(driver)}
                                   >
                                     <Eye className="h-3 w-3 mr-1" />
                                     Details
                                   </Button>
                                   <Button
                                     variant="outline"
                                     size="sm"
                                     onClick={() => openEditDialog(driver)}
                                   >
                                     <Edit className="h-3 w-3" />
                                   </Button>
                                   {driver.driving_license_document && (
                                     <Button
                                       variant="outline"
                                       size="sm"
                                       onClick={() => toggleDocumentView(driver.id)}
                                     >
                                       {showDocuments[driver.id] ? (
                                         <EyeOff className="h-3 w-3" />
                                       ) : (
                                         <Eye className="h-3 w-3" />
                                       )}
                                     </Button>
                                   )}
                                   <ConfirmDelete
                                     title="Remove Driver"
                                     description={`Are you sure you want to remove ${driver.name}? This will delete their account and all associated data.`}
                                     onConfirm={() => deleteDriverMutation.mutate(driver.id)}
                                   >
                                     <Button variant="outline" size="sm">
                                       <Trash2 className="h-3 w-3" />
                                     </Button>
                                   </ConfirmDelete>
                                 </div>
                               </TableCell>
                            </TableRow>
                            {/* Onboarding completion info */}
                            {driver.onboardingCompletedAt && (
                              <TableRow className="bg-muted/50">
                                <TableCell colSpan={6} className="py-2 px-4">
                                  <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                                    <div className="flex items-center space-x-1">
                                      <Clock className="h-3 w-3" />
                                      <span>Onboarding completed: {format(new Date(driver.onboardingCompletedAt), 'PPp')}</span>
                                    </div>
                                    {(driver.emergency_contact_name || driver.vehicle_notes) && (
                                      <div className="flex items-center space-x-1">
                                        <Calendar className="h-3 w-3" />
                                        <span>Additional info available</span>
                                      </div>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Edit Driver Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Edit Driver Details</DialogTitle>
                  <DialogDescription>
                    Update driver personal information and rates
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleEditSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="editFirstName">First Name</Label>
                      <Input
                        id="editFirstName"
                        value={editFormData.firstName}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, firstName: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="editLastName">Last Name</Label>
                      <Input
                        id="editLastName"
                        value={editFormData.lastName}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, lastName: e.target.value }))}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="editPhone">Phone Number</Label>
                    <Input
                      id="editPhone"
                      type="tel"
                      value={editFormData.phone}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, phone: e.target.value }))}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="editParcelRate">Parcel Rate (£)</Label>
                      <Input
                        id="editParcelRate"
                        type="number"
                        step="0.01"
                        value={editFormData.parcelRate}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, parcelRate: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="editCoverRate">Cover Rate (£)</Label>
                      <Input
                        id="editCoverRate"
                        type="number"
                        step="0.01"
                        value={editFormData.coverRate}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, coverRate: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={updateDriverMutation.isPending}
                    >
                      {updateDriverMutation.isPending ? 'Updating...' : 'Update Driver'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Driver Details Modal */}
        <DriverDetailsModal
          driver={selectedDriver}
          isOpen={isDetailsModalOpen}
          onClose={() => {
            setIsDetailsModalOpen(false);
            setSelectedDriver(null);
          }}
        />
      </SidebarInset>
    </SidebarProvider>
  );
};

export default DriverManagement;