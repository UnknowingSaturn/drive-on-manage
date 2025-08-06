import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Mail, Phone, DollarSign, UserCheck, UserX } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';

const DriverManagement = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    hourlyRate: ''
  });

  // Fetch drivers for the company
  const { data: drivers, isLoading } = useQuery({
    queryKey: ['drivers', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      
      const { data: drivers, error: driversError } = await supabase
        .from('driver_profiles')
        .select('*')
        .eq('company_id', profile.company_id);

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
    enabled: !!profile?.company_id
  });

   // Invite driver mutation
  const inviteDriverMutation = useMutation({
    mutationFn: async (driverData: typeof formData) => {
      console.log('=== DEBUG: Starting driver invitation ===');
      console.log('Current profile:', profile);
      
      // Get fresh profile data in case it was updated
      const { data: freshProfile, error: profileError } = await supabase
        .from('profiles')
        .select('company_id, user_id')
        .eq('user_id', profile?.user_id)
        .maybeSingle();

      console.log('Fresh profile data:', freshProfile);
      console.log('Profile error:', profileError);

      if (profileError) {
        console.error('Profile fetch error:', profileError);
        throw new Error('Failed to fetch profile data: ' + profileError.message);
      }

      const companyId = freshProfile?.company_id || profile?.company_id;
      console.log('Using company ID:', companyId);

      if (!companyId) {
        throw new Error('No company assigned to your profile. Please go to Companies page and create/assign a company first.');
      }

      console.log('Calling edge function with data:', {
        email: driverData.email,
        firstName: driverData.firstName,
        lastName: driverData.lastName,
        phone: driverData.phone,
        hourlyRate: driverData.hourlyRate,
        companyId: companyId
      });

      const { data, error } = await supabase.functions.invoke('invite-driver', {
        body: {
          email: driverData.email,
          firstName: driverData.firstName,
          lastName: driverData.lastName,
          phone: driverData.phone,
          hourlyRate: driverData.hourlyRate,
          companyId: companyId
        }
      });

      console.log('Edge function response:', { data, error });

      if (error) {
        console.error('Function invoke error:', error);
        throw new Error(`Edge function error: ${error.message || 'Failed to invoke function'}`);
      }

      if (!data?.success) {
        console.error('Function returned error:', data);
        throw new Error(data?.error || 'Function completed but returned error');
      }

      console.log('=== DEBUG: Driver invitation successful ===');
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Driver invited successfully",
        description: "The driver has been added to your team.",
      });
      setIsDialogOpen(false);
      setFormData({
        email: '',
        firstName: '',
        lastName: '',
        phone: '',
        hourlyRate: ''
      });
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

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    inviteDriverMutation.mutate(formData);
  };

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
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
                <h1 className="text-xl font-semibold text-foreground">Driver Management</h1>
                <p className="text-sm text-muted-foreground">Manage your driver workforce</p>
              </div>
            </div>
          </header>

          <main className="p-6 space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold">Team Overview</h2>
                <p className="text-muted-foreground">Current driver workforce</p>
              </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
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
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) => handleInputChange('firstName', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) => handleInputChange('lastName', e.target.value)}
                    required
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="phone">Mobile Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                />
              </div>
              
              <div>
                <Label htmlFor="hourlyRate">Rate (£)</Label>
                <Input
                  id="hourlyRate"
                  type="number"
                  step="0.01"
                  value={formData.hourlyRate}
                  onChange={(e) => handleInputChange('hourlyRate', e.target.value)}
                  placeholder="Enter hourly rate"
                />
              </div>
              
              <Button type="submit" className="w-full" disabled={inviteDriverMutation.isPending}>
                <Mail className="h-4 w-4 mr-2" />
                {inviteDriverMutation.isPending ? 'Sending Invite...' : 'Send Invite'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Drivers</CardTitle>
          <CardDescription>Manage your current driver workforce</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Mobile</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {drivers?.map((driver) => (
                <TableRow key={driver.id}>
                  <TableCell className="font-medium">
                    {driver.profiles?.first_name} {driver.profiles?.last_name}
                  </TableCell>
                  <TableCell>{driver.profiles?.email}</TableCell>
                  <TableCell>{driver.profiles?.phone || '-'}</TableCell>
                  <TableCell>
                    {driver.hourly_rate ? `£${driver.hourly_rate}/hr` : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={driver.status === 'active' ? 'default' : 'secondary'}>
                      {driver.status === 'active' ? (
                        <>
                          <UserCheck className="h-3 w-3 mr-1" />
                          Active
                        </>
                      ) : (
                        <>
                          <UserX className="h-3 w-3 mr-1" />
                          Inactive
                        </>
                      )}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm">
                        Edit
                      </Button>
                      <Button variant="outline" size="sm">
                        <Phone className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {drivers?.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No drivers found. Start by inviting your first driver.
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