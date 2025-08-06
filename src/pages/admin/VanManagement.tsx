import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Truck, AlertTriangle, CheckCircle, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, differenceInDays, parseISO } from 'date-fns';

const VanManagement = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    registration: '',
    make: '',
    model: '',
    year: '',
    motExpiry: '',
    serviceDue: ''
  });

  // Fetch vans for the company
  const { data: vans, isLoading } = useQuery({
    queryKey: ['vans', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      
      const { data, error } = await supabase
        .from('vans')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('is_active', true)
        .order('registration');

      if (error) throw error;
      return data;
    },
    enabled: !!profile?.company_id
  });

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

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addVanMutation.mutate(formData);
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
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Van Management</h1>
          <p className="text-muted-foreground">Manage your fleet of delivery vehicles</p>
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
                    {van.mot_expiry ? format(parseISO(van.mot_expiry), 'dd/MM/yyyy') : '-'}
                  </TableCell>
                  <TableCell>
                    {van.service_due ? format(parseISO(van.service_due), 'dd/MM/yyyy') : '-'}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(van.mot_expiry, van.service_due)}
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm">
                      Edit
                    </Button>
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
    </div>
  );
};

export default VanManagement;