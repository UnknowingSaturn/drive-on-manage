import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Truck, AlertTriangle, CheckCircle, Calendar, Edit, Trash2, UserCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, differenceInDays, parseISO } from 'date-fns';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { ComponentErrorBoundary } from '@/components/ComponentErrorBoundary';
import { LoadingSpinner } from '@/components/LoadingSpinner';


const VanManagement = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [editingVan, setEditingVan] = useState<any>(null);
  const [assigningVan, setAssigningVan] = useState<any>(null);
  const [vanToDelete, setVanToDelete] = useState<any>(null);
  const [selectedDriverId, setSelectedDriverId] = useState<string>('UNASSIGNED');
  const [formData, setFormData] = useState({
    registration: '',
    make: '',
    model: '',
    year: '',
    motExpiry: '',
    serviceDue: ''
  });

  // Fetch drivers for assignment - use the same pattern as driver management
  const { data: drivers, isLoading: driversLoading, error: driversError } = useQuery({
    queryKey: ['available-drivers', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      
      console.log('Fetching drivers for van assignment, company_id:', profile.company_id);
      
      // Use the same query pattern as the working driver management page
      const { data, error } = await supabase
        .rpc('get_drivers_with_profiles', {
          company_ids: [profile.company_id]
        });

      if (error) {
        console.error('Error fetching drivers for van assignment:', error);
        throw error;
      }
      
      console.log('Van assignment drivers query result:', data);
      
      // Return all drivers with availability info
      return data?.map((driver: any) => ({
        ...driver,
        name: `${driver.first_name || ''} ${driver.last_name || ''}`.trim(),
        isAvailable: !driver.assigned_van_id
      })) || [];
    },
    enabled: !!profile?.company_id
  });

  // Fetch vans for the company with assigned driver info
  const { data: vans, isLoading, error } = useQuery({
    queryKey: ['vans', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      
      // First get all vans
      const { data: vansData, error: vansError } = await supabase
        .from('vans')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('is_active', true)
        .order('registration');

      if (vansError) throw vansError;

      // Then get all drivers with their assigned vans
      const { data: driversData, error: driversError } = await supabase
        .from('driver_profiles')
        .select(`
          id,
          assigned_van_id,
          profiles(first_name, last_name)
        `)
        .eq('company_id', profile.company_id)
        .not('assigned_van_id', 'is', null);

      if (driversError) throw driversError;

      // Map vans with their assigned drivers
      return vansData.map((van: any) => {
        const assignedDriver = driversData.find(driver => driver.assigned_van_id === van.id);
        return {
          ...van,
          assignedDriver: assignedDriver && assignedDriver.profiles ? {
            id: assignedDriver.id,
            name: `${assignedDriver.profiles.first_name || ''} ${assignedDriver.profiles.last_name || ''}`.trim()
          } : null
        };
      });
    },
    enabled: !!profile?.company_id,
    retry: 3,
    retryDelay: 1000
  });

  // Set up real-time subscriptions
  useEffect(() => {
    if (!profile?.company_id) return;

    const channel = supabase
      .channel('van-management-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vans',
          filter: `company_id=eq.${profile.company_id}`
        },
        () => {
          console.log('Van data changed, invalidating queries');
          queryClient.invalidateQueries({ queryKey: ['vans'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'driver_profiles',
          filter: `company_id=eq.${profile.company_id}`
        },
        () => {
          console.log('Driver profile changed, invalidating queries');
          queryClient.invalidateQueries({ queryKey: ['vans'] });
          queryClient.invalidateQueries({ queryKey: ['available-drivers'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.company_id, queryClient]);

  // Add van mutation
  const addVanMutation = useMutation({
    mutationFn: async (vanData: typeof formData) => {
      const { error } = await supabase
        .from('vans')
        .insert({
          registration: vanData.registration.toUpperCase(),
          make: vanData.make,
          model: vanData.model,
          year: vanData.year ? parseInt(vanData.year) : null,
          mot_expiry: vanData.motExpiry || null,
          service_due: vanData.serviceDue || null,
          company_id: profile?.company_id
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Van registered successfully",
        description: "The vehicle has been added to your fleet.",
      });
      setIsDialogOpen(false);
      setFormData({
        registration: '',
        make: '',
        model: '',
        year: '',
        motExpiry: '',
        serviceDue: ''
      });
      queryClient.invalidateQueries({ queryKey: ['vans'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error registering van",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update van mutation
  const updateVanMutation = useMutation({
    mutationFn: async (vanData: { id: string } & typeof formData) => {
      const { error } = await supabase
        .from('vans')
        .update({
          registration: vanData.registration.toUpperCase(),
          make: vanData.make,
          model: vanData.model,
          year: vanData.year ? parseInt(vanData.year) : null,
          mot_expiry: vanData.motExpiry || null,
          service_due: vanData.serviceDue || null,
        })
        .eq('id', vanData.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Van updated successfully",
        description: "The vehicle information has been updated.",
      });
      setIsEditDialogOpen(false);
      setEditingVan(null);
      setFormData({
        registration: '',
        make: '',
        model: '',
        year: '',
        motExpiry: '',
        serviceDue: ''
      });
      queryClient.invalidateQueries({ queryKey: ['vans'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating van",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete van mutation
  const deleteVanMutation = useMutation({
    mutationFn: async (vanId: string) => {
      const { error } = await supabase
        .from('vans')
        .update({ is_active: false })
        .eq('id', vanId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Van deleted successfully",
        description: "The vehicle has been removed from your fleet.",
      });
      setVanToDelete(null);
      queryClient.invalidateQueries({ queryKey: ['vans'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error deleting van",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Assign van to driver mutation
  const assignVanMutation = useMutation({
    mutationFn: async ({ vanId, driverId }: { vanId: string, driverId: string }) => {
      // First, unassign any other vans from this driver if assigning
      if (driverId !== 'UNASSIGNED') {
        await supabase
          .from('driver_profiles')
          .update({ assigned_van_id: null })
          .eq('id', driverId);
      }

      // Then assign the van to the selected driver (or unassign if UNASSIGNED)
      if (driverId === 'UNASSIGNED') {
        // Unassign the van from any driver
        await supabase
          .from('driver_profiles')
          .update({ assigned_van_id: null })
          .eq('assigned_van_id', vanId);
      } else {
        // Assign the van to the selected driver
        const { error } = await supabase
          .from('driver_profiles')
          .update({ assigned_van_id: vanId })
          .eq('id', driverId);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: "Van assignment updated",
        description: "Van assignment has been updated successfully.",
      });
      setIsAssignDialogOpen(false);
      setAssigningVan(null);
      setSelectedDriverId('UNASSIGNED');
      queryClient.invalidateQueries({ queryKey: ['vans'] });
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating assignment",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleEditVan = (van: any) => {
    setEditingVan(van);
    setFormData({
      registration: van.registration,
      make: van.make || '',
      model: van.model || '',
      year: van.year?.toString() || '',
      motExpiry: van.mot_expiry || '',
      serviceDue: van.service_due || ''
    });
    setIsEditDialogOpen(true);
  };

  const handleDeleteVan = (van: any) => {
    setVanToDelete(van);
  };

  const handleAssignVan = (van: any) => {
    // Find the most up-to-date van data from the current query results
    const currentVan = vans?.find(v => v.id === van.id) || van;
    setAssigningVan(currentVan);
    // Set the current driver ID, ensuring it matches the driver ID from the drivers list
    const currentDriverId = currentVan.assignedDriver?.id || 'UNASSIGNED';
    console.log('Setting driver ID for van assignment:', { 
      originalVan: van, 
      currentVan, 
      currentDriverId, 
      assignedDriver: currentVan.assignedDriver 
    });
    setSelectedDriverId(currentDriverId);
    setIsAssignDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addVanMutation.mutate(formData);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingVan) {
      updateVanMutation.mutate({ ...formData, id: editingVan.id });
    }
  };

  const getStatusBadge = (motExpiry: string | null, serviceDue: string | null) => {
    const today = new Date();
    const motDate = motExpiry ? parseISO(motExpiry) : null;
    const serviceDate = serviceDue ? parseISO(serviceDue) : null;
    
    let daysToMot = motDate ? differenceInDays(motDate, today) : 999;
    let daysToService = serviceDate ? differenceInDays(serviceDate, today) : 999;
    
    if (daysToMot <= 0 || daysToService <= 0) {
      return (
        <Badge variant="destructive">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Overdue
        </Badge>
      );
    }
    
    if (daysToMot <= 30 || daysToService <= 30) {
      return (
        <Badge className="bg-warning text-warning-foreground">
          <Calendar className="h-3 w-3 mr-1" />
          Due Soon
        </Badge>
      );
    }
    
    return (
      <Badge className="bg-success text-success-foreground">
        <CheckCircle className="h-3 w-3 mr-1" />
        Current
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-background">
          <AppSidebar />
          <SidebarInset className="flex-1">
            <LoadingSpinner text="Loading van management..." />
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
          <SidebarInset className="flex-1">
            <ComponentErrorBoundary componentName="Van Management">
              <div className="p-6">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center text-destructive">
                      <AlertTriangle className="h-12 w-12 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">Failed to load vans</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        {error?.message || 'An unexpected error occurred'}
                      </p>
                      <Button onClick={() => window.location.reload()}>
                        Try Again
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </ComponentErrorBoundary>
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
                <h1 className="text-xl font-semibold text-foreground">Van Management</h1>
                <p className="text-sm text-muted-foreground">Manage your fleet of delivery vehicles</p>
              </div>
            </div>
          </header>

          <main className="p-6 space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold">Fleet Overview</h2>
                <p className="text-muted-foreground">Vehicle management dashboard</p>
              </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Register Van
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Register New Van</DialogTitle>
              <DialogDescription>
                Add a new delivery vehicle to your fleet.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="registration">Registration Number</Label>
                <Input
                  id="registration"
                  value={formData.registration}
                  onChange={(e) => handleInputChange('registration', e.target.value)}
                  placeholder="e.g. AB12 CDE"
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="make">Make</Label>
                  <Input
                    id="make"
                    value={formData.make}
                    onChange={(e) => handleInputChange('make', e.target.value)}
                    placeholder="e.g. Ford"
                  />
                </div>
                <div>
                  <Label htmlFor="model">Model</Label>
                  <Input
                    id="model"
                    value={formData.model}
                    onChange={(e) => handleInputChange('model', e.target.value)}
                    placeholder="e.g. Transit"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="year">Year</Label>
                <Input
                  id="year"
                  type="number"
                  value={formData.year}
                  onChange={(e) => handleInputChange('year', e.target.value)}
                  placeholder="e.g. 2022"
                  min="1900"
                  max={new Date().getFullYear() + 1}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="motExpiry">MOT Expiry</Label>
                  <Input
                    id="motExpiry"
                    type="date"
                    value={formData.motExpiry}
                    onChange={(e) => handleInputChange('motExpiry', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="serviceDue">Service Due</Label>
                  <Input
                    id="serviceDue"
                    type="date"
                    value={formData.serviceDue}
                    onChange={(e) => handleInputChange('serviceDue', e.target.value)}
                  />
                </div>
              </div>
              
              <Button type="submit" className="w-full" disabled={addVanMutation.isPending}>
                <Truck className="h-4 w-4 mr-2" />
                {addVanMutation.isPending ? 'Registering...' : 'Register Van'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Vans</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{vans?.length || 0}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">MOT Due Soon</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">
              {vans?.filter(van => {
                if (!van.mot_expiry) return false;
                const daysToMot = differenceInDays(parseISO(van.mot_expiry), new Date());
                return daysToMot <= 30 && daysToMot > 0;
              }).length || 0}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Service Due Soon</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">
              {vans?.filter(van => {
                if (!van.service_due) return false;
                const daysToService = differenceInDays(parseISO(van.service_due), new Date());
                return daysToService <= 30 && daysToService > 0;
              }).length || 0}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {vans?.filter(van => {
                const today = new Date();
                const motOverdue = van.mot_expiry ? differenceInDays(parseISO(van.mot_expiry), today) <= 0 : false;
                const serviceOverdue = van.service_due ? differenceInDays(parseISO(van.service_due), today) <= 0 : false;
                return motOverdue || serviceOverdue;
              }).length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fleet Overview</CardTitle>
          <CardDescription>Your registered delivery vehicles</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Registration</TableHead>
                <TableHead>Make & Model</TableHead>
                <TableHead>Year</TableHead>
                <TableHead>Assigned Driver</TableHead>
                <TableHead>MOT Expiry</TableHead>
                <TableHead>Service Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vans?.map((van) => (
                <TableRow key={van.id}>
                  <TableCell className="font-medium">{van.registration}</TableCell>
                  <TableCell>
                    {van.make} {van.model}
                  </TableCell>
                  <TableCell>{van.year || '-'}</TableCell>
                  <TableCell>
                    {van.assignedDriver ? (
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                          {van.assignedDriver.name}
                        </Badge>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">Unassigned</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {van.mot_expiry ? format(parseISO(van.mot_expiry), 'dd/MM/yyyy') : '-'}
                  </TableCell>
                  <TableCell>
                    {van.service_due ? format(parseISO(van.service_due), 'dd/MM/yyyy') : '-'}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(van.mot_expiry, van.service_due)}
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-1">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleAssignVan(van)}
                        className="text-blue-600 hover:text-blue-700"
                      >
                        <UserCheck className="h-3 w-3 mr-1" />
                        Assign Driver
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleEditVan(van)}
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleDeleteVan(van)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {vans?.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No vans registered. Start by adding your first vehicle.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Van Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Van</DialogTitle>
            <DialogDescription>
              Update the details of this vehicle.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div>
              <Label htmlFor="edit-registration">Registration Number</Label>
              <Input
                id="edit-registration"
                value={formData.registration}
                onChange={(e) => handleInputChange('registration', e.target.value)}
                placeholder="e.g. AB12 CDE"
                required
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-make">Make</Label>
                <Input
                  id="edit-make"
                  value={formData.make}
                  onChange={(e) => handleInputChange('make', e.target.value)}
                  placeholder="e.g. Ford"
                />
              </div>
              <div>
                <Label htmlFor="edit-model">Model</Label>
                <Input
                  id="edit-model"
                  value={formData.model}
                  onChange={(e) => handleInputChange('model', e.target.value)}
                  placeholder="e.g. Transit"
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="edit-year">Year</Label>
              <Input
                id="edit-year"
                type="number"
                value={formData.year}
                onChange={(e) => handleInputChange('year', e.target.value)}
                placeholder="e.g. 2022"
                min="1900"
                max={new Date().getFullYear() + 1}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-motExpiry">MOT Expiry</Label>
                <Input
                  id="edit-motExpiry"
                  type="date"
                  value={formData.motExpiry}
                  onChange={(e) => handleInputChange('motExpiry', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="edit-serviceDue">Service Due</Label>
                <Input
                  id="edit-serviceDue"
                  type="date"
                  value={formData.serviceDue}
                  onChange={(e) => handleInputChange('serviceDue', e.target.value)}
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsEditDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateVanMutation.isPending}>
                <Truck className="h-4 w-4 mr-2" />
                {updateVanMutation.isPending ? 'Updating...' : 'Update Van'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!vanToDelete} onOpenChange={(open) => !open && setVanToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center">
              <AlertTriangle className="h-4 w-4 mr-2 text-destructive" />
              Delete Van
            </AlertDialogTitle>
            <AlertDialogDescription>
              {vanToDelete && `Are you sure you want to delete ${vanToDelete.registration}? This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteVanMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => vanToDelete && deleteVanMutation.mutate(vanToDelete.id)}
              disabled={deleteVanMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteVanMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
        </AlertDialog>

        {/* Assign Van Dialog */}
        <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Assign Van to Driver</DialogTitle>
              <DialogDescription>
                {assigningVan && `Assign ${assigningVan.registration} to a driver`}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="driver-select">Select Driver</Label>
                <Select
                  value={selectedDriverId}
                  onValueChange={setSelectedDriverId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a driver" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border border-border shadow-md z-50">
                    <SelectItem value="UNASSIGNED">Unassigned</SelectItem>
                    {drivers?.map((driver) => {
                      // Check if this driver is currently assigned to the van being edited
                      const isCurrentlyAssigned = assigningVan?.assignedDriver?.id === driver.id;
                      // Allow selection if driver is available OR if they're currently assigned to this van
                      const canSelect = driver.isAvailable || isCurrentlyAssigned;
                      
                      return (
                        <SelectItem 
                          key={driver.id} 
                          value={driver.id}
                          disabled={!canSelect}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span>{driver.name}</span>
                            {isCurrentlyAssigned && (
                              <Badge variant="default" className="ml-2 text-xs">
                                Currently Assigned
                              </Badge>
                            )}
                            {!driver.isAvailable && !isCurrentlyAssigned && (
                              <Badge variant="secondary" className="ml-2 text-xs">
                                Already Assigned
                              </Badge>
                            )}
                            {driver.isAvailable && !isCurrentlyAssigned && (
                              <Badge variant="outline" className="ml-2 text-xs bg-success/10 text-success border-success/30">
                                Available
                              </Badge>
                            )}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {drivers && drivers.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No active drivers found. Please ensure drivers are properly registered and active.
                  </p>
                )}
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsAssignDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={() => assigningVan && assignVanMutation.mutate({ 
                    vanId: assigningVan.id, 
                    driverId: selectedDriverId
                  })}
                  disabled={assignVanMutation.isPending}
                >
                  {assignVanMutation.isPending ? 'Assigning...' : 'Assign Van'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default VanManagement;
