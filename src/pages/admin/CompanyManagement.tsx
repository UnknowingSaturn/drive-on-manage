import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Building2, Mail, Phone, MapPin, Edit, Trash2 } from 'lucide-react';
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
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: ''
  });
  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: ''
  });

  // Fetch companies
  const { data: companies, isLoading, refetch } = useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false });

      
      if (error) {
        console.error('Error fetching companies:', error);
        throw error;
      }
      return data;
    },
    // Force refetch every time the component mounts
    staleTime: 0,
    gcTime: 0
  });

  // Create company mutation
  const createCompanyMutation = useMutation({
    mutationFn: async (companyData: typeof formData) => {
      
      // Ensure we have a valid session and refresh it if needed
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session?.access_token) {
        console.error('Session error:', sessionError);
        throw new Error('No valid session found. Please log in again.');
      }
      
      // Insert company directly
      const { data: company, error } = await supabase
        .from('companies')
        .insert({
          name: companyData.name,
          email: companyData.email,
          phone: companyData.phone || null,
          address: companyData.address || null,
          created_by: session.user.id
        })
        .select()
        .single();

      if (error) {
        console.error('Database error:', error);
        throw error;
      }

      // Create user-company association
      const { error: userCompanyError } = await supabase
        .from('user_companies')
        .insert({
          user_id: session.user.id,
          company_id: company.id,
          role: 'admin'
        });

      if (userCompanyError) {
        console.error('Error creating user-company association:', userCompanyError);
        throw new Error('Company created but failed to assign to profile');
      }

      return company;
    },
    onSuccess: () => {
      toast({
        title: "Location created successfully",
        description: "The new location has been added and assigned to your profile.",
      });
      setIsDialogOpen(false);
      setFormData({
        name: '',
        email: '',
        phone: '',
        address: ''
      });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      // Refresh auth context to get updated profile with company_id
      window.location.reload();
    },
    onError: (error: any) => {
      toast({
        title: "Error creating location",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Update company mutation
  const updateCompanyMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: typeof editFormData }) => {
      const { error } = await supabase
        .from('companies')
        .update({
          name: data.name,
          email: data.email,
          phone: data.phone || null,
          address: data.address || null,
        })
        .eq('id', id);

      if (error) throw error;
      return { id, data };
    },
    onSuccess: () => {
      toast({
        title: "Location updated successfully",
        description: "The location has been updated.",
      });
      setIsEditDialogOpen(false);
      setSelectedCompany(null);
      queryClient.invalidateQueries({ queryKey: ['companies'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating location",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete company mutation
  const deleteCompanyMutation = useMutation({
    mutationFn: async (companyId: string) => {
      const { error } = await supabase
        .from('companies')
        .delete()
        .eq('id', companyId);

      if (error) throw error;
      return companyId;
    },
    onSuccess: () => {
      toast({
        title: "Location deleted successfully",
        description: "The location has been removed.",
      });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error deleting location",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createCompanyMutation.mutate(formData);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCompany) {
      updateCompanyMutation.mutate({
        id: selectedCompany.id,
        data: editFormData
      });
    }
  };

  const handleEditCompany = (company: any) => {
    setSelectedCompany(company);
    setEditFormData({
      name: company.name,
      email: company.email,
      phone: company.phone || '',
      address: company.address || ''
    });
    setIsEditDialogOpen(true);
  };

  const handleDeleteCompany = (companyId: string) => {
    if (confirm('Are you sure you want to delete this location? This action cannot be undone.')) {
      deleteCompanyMutation.mutate(companyId);
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
                <h1 className="text-xl font-semibold text-foreground">My Locations</h1>
                <p className="text-sm text-muted-foreground">Manage your locations</p>
              </div>
            </div>
          </header>

          <main className="saas-main">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="saas-title">Locations Overview</h2>
                <p className="saas-subtitle">Manage all your locations</p>
              </div>
        
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Location
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Add New Location</DialogTitle>
                    <DialogDescription>
                      Create a new location profile.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <Label htmlFor="name">Location Name <span className="text-destructive">*</span></Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        placeholder="Enter location name"
                        required
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="email">Location Email <span className="text-destructive">*</span></Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        placeholder="location@example.com"
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
                        placeholder="Location address"
                      />
                    </div>
                    
                    
                    <Button type="submit" className="w-full" disabled={createCompanyMutation.isPending}>
                      <Building2 className="h-4 w-4 mr-2" />
                      {createCompanyMutation.isPending ? 'Creating Location...' : 'Create Location'}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>

              {/* Edit Company Dialog */}
              <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Edit Location</DialogTitle>
                    <DialogDescription>
                      Update the location information.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleEditSubmit} className="space-y-4">
                    <div>
                      <Label htmlFor="edit-name">Location Name <span className="text-destructive">*</span></Label>
                      <Input
                        id="edit-name"
                        value={editFormData.name}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Enter location name"
                        required
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="edit-email">Location Email <span className="text-destructive">*</span></Label>
                      <Input
                        id="edit-email"
                        type="email"
                        value={editFormData.email}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="location@example.com"
                        required
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="edit-phone">Phone Number</Label>
                      <Input
                        id="edit-phone"
                        type="tel"
                        value={editFormData.phone}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="+44 123 456 7890"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="edit-address">Address</Label>
                      <Input
                        id="edit-address"
                        value={editFormData.address}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, address: e.target.value }))}
                        placeholder="Location address"
                      />
                    </div>
                    
                    <Button type="submit" className="w-full" disabled={updateCompanyMutation.isPending}>
                      <Building2 className="h-4 w-4 mr-2" />
                      {updateCompanyMutation.isPending ? 'Updating Location...' : 'Update Location'}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <Card className="saas-card">
              <CardHeader className="saas-card-header">
                <CardTitle className="saas-heading">Active Locations</CardTitle>
                <CardDescription className="saas-subtitle">All your locations</CardDescription>
              </CardHeader>
              <CardContent className="saas-card-content">
                <Table className="saas-table">
                  <TableHeader className="saas-table-header">
                    <TableRow>
                      <TableHead className="saas-table-head">Location Name</TableHead>
                      <TableHead className="saas-table-head">Contact</TableHead>
                      <TableHead className="saas-table-head">Address</TableHead>
                      <TableHead className="saas-table-head">Status</TableHead>
                      <TableHead className="saas-table-head">Created</TableHead>
                      <TableHead className="saas-table-head">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {companies?.map((company) => (
                      <TableRow key={company.id} className="saas-table-row">
                        <TableCell className="saas-table-cell font-medium">
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
                          <Badge variant={company.is_active ? 'default' : 'secondary'}>
                            {company.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(company.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleEditCompany(company)}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleDeleteCompany(company.id)}
                            >
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
                    No locations found. Start by adding your first location.
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