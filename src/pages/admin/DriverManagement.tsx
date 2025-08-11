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
  const { profile } = useAuth();
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

  // Fetch drivers for the company
  const { data: drivers = [], isLoading, error } = useQuery({
    queryKey: ['drivers', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      
      // Fetch active driver profiles with van assignments and profile data
      const { data: drivers, error: driversError } = await supabase
        .from('driver_profiles')
        .select(`
          *,
          assigned_van:vans(id, registration, make, model),
          profiles!inner(first_name, last_name, email, phone, is_active)
        `)
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false });

      if (driversError) {
        console.error('Error fetching drivers:', driversError);
        throw driversError;
      }

      // Transform driver data for the UI
      return (drivers || []).map(driver => ({
        ...driver,
        type: 'active' as const,
        name: `${driver.profiles.first_name} ${driver.profiles.last_name}`,
        email: driver.profiles.email,
        phone: driver.profiles.phone,
        isActive: driver.profiles.is_active,
        status: driver.first_login_completed ? 'active' : 'pending_first_login',
        onboardingCompletedAt: driver.onboarding_completed_at
      }));
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

  // Create driver mutation with direct Supabase Admin API calls
  const createDriverMutation = useMutation({
    mutationFn: async (driverData: typeof formData) => {
      console.log('Form data before validation:', driverData);
      
      // Validate all form data
      const validation = validateForm(driverData, driverCreateSchema);
      console.log('Validation result:', validation);
      
      if (!validation.success) {
        console.log('Validation errors:', validation.errors);
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
        parcelRate: driverData.parcelRate,
        coverRate: driverData.coverRate
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

      // Check for duplicate email in existing profiles
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', sanitizedData.email)
        .eq('company_id', companyId)
        .maybeSingle();

      if (existingProfile) {
        throw new Error('A user with this email already exists in your company');
      }

      // Generate a secure temporary password
      const generateTempPassword = (): string => {
        const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const lowercase = 'abcdefghijklmnopqrstuvwxyz';
        const numbers = '0123456789';
        const symbols = '!@#$%^&*';
        
        const all = uppercase + lowercase + numbers + symbols;
        let password = '';
        
        // Ensure at least one character from each category
        password += uppercase[Math.floor(Math.random() * uppercase.length)];
        password += lowercase[Math.floor(Math.random() * lowercase.length)];
        password += numbers[Math.floor(Math.random() * numbers.length)];
        password += symbols[Math.floor(Math.random() * symbols.length)];
        
        // Fill the rest randomly
        for (let i = password.length; i < 12; i++) {
          password += all[Math.floor(Math.random() * all.length)];
        }
        
        // Shuffle the password
        return password.split('').sort(() => Math.random() - 0.5).join('');
      };

      const tempPassword = generateTempPassword();

      // Call the new create-driver-admin edge function with service role permissions
      const { data: createResult, error: createUserError } = await supabase.functions.invoke('create-driver-admin', {
        body: {
          email: sanitizedData.email,
          firstName: sanitizedData.firstName,
          lastName: sanitizedData.lastName,
          phone: sanitizedData.phone,
          parcelRate: sanitizedData.parcelRate,
          coverRate: sanitizedData.coverRate,
          companyId: companyId
        }
      });

      if (createUserError) {
        console.error('Failed to create driver:', createUserError);
        throw new Error(`Failed to create driver account: ${createUserError.message}`);
      }

      if (!createResult?.success) {
        throw new Error('Driver creation failed - no success response returned');
      }

      console.log('Driver created successfully via edge function:', createResult.userId);

      return {
        userId: createResult.userId,
        tempPassword: createResult.tempPassword,
        success: true
      };
    },
    onSuccess: (data) => {
      console.log('Driver created successfully:', data);
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
        coverRate: ''
      });
      setFormErrors({});
      setShowFormErrors(false);
      
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
    },
    onError: (error: any) => {
      console.error('Driver creation error:', error);
      
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

  // Delete driver mutation with edge function
  const deleteDriverMutation = useMutation({
    mutationFn: async (driverId: string) => {
      // Call the delete-driver-admin edge function
      const { data, error } = await supabase.functions.invoke('delete-driver-admin', {
        body: {
          driverId: driverId,
          cleanupUser: true
        }
      });

      if (error) {
        console.error('Edge function error:', error);
        throw new Error(`Failed to remove driver: ${error.message || 'Unknown error'}`);
      }

      if (!data?.success) {
        console.error('Edge function returned failure:', data);
        throw new Error(data?.error || 'Failed to remove driver');
      }

      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Driver removed successfully",
        description: "Driver account has been removed and cleaned up.",
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
      firstName: driver.profiles.first_name || '',
      lastName: driver.profiles.last_name || '',
      phone: driver.profiles.phone || '',
      parcelRate: driver.parcel_rate?.toString() || '',
      coverRate: driver.cover_rate?.toString() || '',
      status: driver.status || 'active',
      assignedVanId: driver.assigned_van_id || ''
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
                  <DialogTitle>Edit Driver</DialogTitle>
                  <DialogDescription>
                    Update driver information and assignments
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

                  <div className="space-y-2">
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
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="editVanAssignment">Van Assignment</Label>
                    <Select
                      value={editFormData.assignedVanId}
                      onValueChange={(value) => setEditFormData(prev => ({ ...prev, assignedVanId: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select van" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">No van assigned</SelectItem>
                        {vans.map((van) => (
                          <SelectItem key={van.id} value={van.id}>
                            {van.registration} - {van.make} {van.model}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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