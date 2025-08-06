import React, { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Mail, Phone, UserCheck, UserX, Edit, Trash2, Clock, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { ConfirmDelete } from '@/components/ConfirmDelete';
import { SmartSearch } from '@/components/SmartSearch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { validateForm, sanitizeInput, emailSchema, nameSchema, phoneSchema, hourlyRateSchema } from '@/lib/security';
import { z } from 'zod';

// Validation schema for driver invitation
const driverInviteSchema = z.object({
  email: emailSchema,
  firstName: nameSchema,
  lastName: nameSchema,
  phone: phoneSchema,
  hourlyRate: z.string().optional()
});

const DriverManagement = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showFormErrors, setShowFormErrors] = useState(false);
  const [filteredDrivers, setFilteredDrivers] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    hourlyRate: ''
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Fetch drivers for the company
  const { data: drivers = [], isLoading, error } = useQuery({
    queryKey: ['drivers', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      
      const { data: drivers, error: driversError } = await supabase
        .from('driver_profiles')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false });

      if (driversError) throw driversError;

      // Fetch profile data separately
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, email, phone, is_active')
        .in('user_id', drivers?.map(d => d.user_id) || []);

      if (profilesError) throw profilesError;

      // Combine the data
      const data = drivers?.map(driver => ({
        ...driver,
        profiles: profiles?.find(p => p.user_id === driver.user_id)
      })) || [];

      return data;
    },
    enabled: !!profile?.company_id,
    refetchInterval: 30000 // Refresh every 30 seconds for real-time updates
  });

  // Set initial filtered data
  React.useEffect(() => {
    setFilteredDrivers(drivers);
  }, [drivers]);

  // Real-time form validation
  const validateField = (field: string, value: string) => {
    const fieldSchema = {
      email: emailSchema,
      firstName: nameSchema,
      lastName: nameSchema,
      phone: phoneSchema,
      hourlyRate: z.string().optional()
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
        hourlyRate: driverData.hourlyRate
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

      const { data, error } = await supabase.functions.invoke('invite-driver', {
        body: {
          ...sanitizedData,
          companyId: companyId
        }
      });

      if (error) {
        throw new Error(`Invitation failed: ${error.message || 'Unknown error'}`);
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to send invitation');
      }

      return data;
    },
    onSuccess: () => {
      toast({
        title: "Driver invited successfully",
        description: "The driver has been added to your team and will receive login credentials via email.",
      });
      setIsDialogOpen(false);
      setFormData({
        email: '',
        firstName: '',
        lastName: '',
        phone: '',
        hourlyRate: ''
      });
      setFormErrors({});
      setShowFormErrors(false);
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error inviting driver",
        description: error.message,
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
                      <Label htmlFor="hourlyRate">Hourly Rate (£)</Label>
                      <Input
                        id="hourlyRate"
                        type="number"
                        step="0.01"
                        min="0"
                        max="1000"
                        value={formData.hourlyRate}
                        onChange={(e) => handleInputChange('hourlyRate', e.target.value)}
                        placeholder="Enter hourly rate"
                        aria-describedby={formErrors.hourlyRate ? 'hourlyRate-error' : undefined}
                      />
                      {formErrors.hourlyRate && (
                        <p id="hourlyRate-error" className="text-sm text-destructive mt-1">
                          {formErrors.hourlyRate}
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
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDrivers.map((driver) => (
                        <TableRow key={driver.id}>
                          <TableCell className="font-medium">
                            <div>
                              <div>{driver.profiles?.first_name} {driver.profiles?.last_name}</div>
                              <div className="text-xs text-muted-foreground sm:hidden">
                                {driver.profiles?.email}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {driver.profiles?.email}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {driver.profiles?.phone || '-'}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {driver.hourly_rate ? `£${driver.hourly_rate}/hr` : '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={
                              driver.status === 'active' ? 'default' : 
                              driver.status === 'pending' ? 'secondary' : 
                              'outline'
                            }>
                              {driver.status === 'active' && (
                                <>
                                  <UserCheck className="h-3 w-3 mr-1" />
                                  Active
                                </>
                              )}
                              {driver.status === 'pending' && (
                                <>
                                  <Clock className="h-3 w-3 mr-1" />
                                  Pending
                                </>
                              )}
                              {driver.status === 'inactive' && (
                                <>
                                  <UserX className="h-3 w-3 mr-1" />
                                  Inactive
                                </>
                              )}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-1">
                              <Button variant="outline" size="sm" title="Edit driver">
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button variant="outline" size="sm" title="Call driver">
                                <Phone className="h-3 w-3" />
                              </Button>
                              <ConfirmDelete
                                title={`Remove ${driver.profiles?.first_name} ${driver.profiles?.last_name}?`}
                                description={
                                  driver.status === 'pending' 
                                    ? "This will cancel the pending invitation and remove the driver profile."
                                    : "This will permanently remove the driver from your team. This action cannot be undone."
                                }
                                onConfirm={() => deleteDriverMutation.mutate(driver.id)}
                                disabled={deleteDriverMutation.isPending}
                              />
                            </div>
                          </TableCell>
                        </TableRow>
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