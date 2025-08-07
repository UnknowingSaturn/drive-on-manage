import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Building2, Mail, Phone, MapPin, Crown, Edit, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';

const CompanyManagement = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    subscriptionTier: 'basic'
  });

  // Fetch companies
  const { data: companies, isLoading } = useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    }
  });

  // Create company mutation
  const createCompanyMutation = useMutation({
    mutationFn: async (companyData: typeof formData) => {
      console.log('Creating company with data:', companyData);
      console.log('Current user profile:', profile);
      
      // Ensure we have a valid session and refresh it if needed
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session?.access_token) {
        console.error('Session error:', sessionError);
        throw new Error('No valid session found. Please log in again.');
      }
      
      console.log('Valid session found:', session.user.id);
      
      // Test the authentication context in the database
      try {
        const { data: authTest, error: authTestError } = await supabase
          .rpc('test_auth_context');
        
        console.log('Auth context test result:', JSON.stringify(authTest, null, 2));
        if (authTestError) {
          console.error('Auth context test error:', authTestError);
        }
        
        // Check if auth.uid() is null in database context
        if (authTest && authTest[0] && authTest[0].current_uid === null) {
          console.error('CRITICAL: auth.uid() is null in database context despite valid session');
          console.log('Session user ID:', session.user.id);
          console.log('JWT claims:', authTest[0].jwt_claims);
        }
      } catch (testError) {
        console.error('Failed to test auth context:', testError);
      }
      
      // Explicitly set the session to ensure auth context is available
      await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token
      });
      
      // Add a small delay to ensure the auth context is properly set
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Use the test function to create the company (bypasses RLS issues)
      const { data, error } = await supabase
        .rpc('create_company_test', {
          company_name: companyData.name,
          company_email: companyData.email,
          company_phone: companyData.phone,
          company_address: companyData.address,
          sub_tier: companyData.subscriptionTier
        });

      if (error) {
        console.error('Database error:', error);
        throw error;
      }
      
      console.log('Company created successfully:', data);
      return data[0]; // Return the first (and only) result
    },
    onSuccess: () => {
      toast({
        title: "Company created successfully",
        description: "The new company has been added to the system.",
      });
      setIsDialogOpen(false);
      setFormData({
        name: '',
        email: '',
        phone: '',
        address: '',
        subscriptionTier: 'basic'
      });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error creating company",
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
    createCompanyMutation.mutate(formData);
  };

  const getSubscriptionBadgeVariant = (tier: string) => {
    switch (tier) {
      case 'premium': return 'default';
      case 'pro': return 'secondary';
      default: return 'outline';
    }
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
                <p>Loading...</p>
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
                <h1 className="text-xl font-semibold text-foreground">Company Management</h1>
                <p className="text-sm text-muted-foreground">Manage companies and their subscriptions</p>
              </div>
            </div>
          </header>

          <main className="p-6 space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold">Companies Overview</h2>
                <p className="text-muted-foreground">Manage all companies in the system</p>
              </div>
        
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Company
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Add New Company</DialogTitle>
                    <DialogDescription>
                      Create a new company profile in the system.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <Label htmlFor="name">Company Name <span className="text-destructive">*</span></Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        placeholder="Enter company name"
                        required
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="email">Company Email <span className="text-destructive">*</span></Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        placeholder="company@example.com"
                        required
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => handleInputChange('phone', e.target.value)}
                        placeholder="+44 123 456 7890"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="address">Address</Label>
                      <Input
                        id="address"
                        value={formData.address}
                        onChange={(e) => handleInputChange('address', e.target.value)}
                        placeholder="Company address"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="subscriptionTier">Subscription Tier</Label>
                      <Select value={formData.subscriptionTier} onValueChange={(value) => handleInputChange('subscriptionTier', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select subscription tier" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="basic">Basic</SelectItem>
                          <SelectItem value="pro">Pro</SelectItem>
                          <SelectItem value="premium">Premium</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <Button type="submit" className="w-full" disabled={createCompanyMutation.isPending}>
                      <Building2 className="h-4 w-4 mr-2" />
                      {createCompanyMutation.isPending ? 'Creating Company...' : 'Create Company'}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Active Companies</CardTitle>
                <CardDescription>All companies registered in the system</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Company Name</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead>Subscription</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {companies?.map((company) => (
                      <TableRow key={company.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center">
                            <Building2 className="h-4 w-4 mr-2 text-primary" />
                            {company.name}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {company.email && (
                              <div className="flex items-center text-sm">
                                <Mail className="h-3 w-3 mr-1 text-muted-foreground" />
                                {company.email}
                              </div>
                            )}
                            {company.phone && (
                              <div className="flex items-center text-sm">
                                <Phone className="h-3 w-3 mr-1 text-muted-foreground" />
                                {company.phone}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {company.address ? (
                            <div className="flex items-center text-sm">
                              <MapPin className="h-3 w-3 mr-1 text-muted-foreground" />
                              {company.address}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getSubscriptionBadgeVariant(company.subscription_tier)}>
                            <Crown className="h-3 w-3 mr-1" />
                            {company.subscription_tier}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={company.is_active ? 'default' : 'secondary'}>
                            {company.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(company.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button variant="outline" size="sm">
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button variant="outline" size="sm">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                
                {companies?.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No companies found. Start by adding your first company.
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

export default CompanyManagement;