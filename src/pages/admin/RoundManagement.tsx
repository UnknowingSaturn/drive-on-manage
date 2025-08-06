import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, MapPin, DollarSign, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';

const RoundManagement = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    roundNumber: '',
    description: '',
    baseRate: '',
    parcelRate: ''
  });

  // Fetch rounds for the company
  const { data: rounds, isLoading } = useQuery({
    queryKey: ['rounds', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      
      const { data, error } = await supabase
        .from('rounds')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('is_active', true)
        .order('round_number');

      if (error) throw error;
      return data;
    },
    enabled: !!profile?.company_id
  });

  // Add round mutation
  const addRoundMutation = useMutation({
    mutationFn: async (roundData: typeof formData) => {
      const { error } = await supabase
        .from('rounds')
        .insert({
          round_number: roundData.roundNumber,
          description: roundData.description,
          base_rate: roundData.baseRate ? parseFloat(roundData.baseRate) : null,
          parcel_rate: roundData.parcelRate ? parseFloat(roundData.parcelRate) : null,
          company_id: profile?.company_id
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Round created successfully",
        description: "The new delivery round has been added.",
      });
      setIsDialogOpen(false);
      setFormData({
        roundNumber: '',
        description: '',
        baseRate: '',
        parcelRate: ''
      });
      queryClient.invalidateQueries({ queryKey: ['rounds'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error creating round",
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
    addRoundMutation.mutate(formData);
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
                <h1 className="text-xl font-semibold text-foreground">Round Management</h1>
                <p className="text-sm text-muted-foreground">Manage delivery rounds and route configurations</p>
              </div>
            </div>
          </header>

          <main className="p-6 space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold">Route Configuration</h2>
                <p className="text-muted-foreground">Setup and manage delivery routes</p>
              </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Round
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create New Round</DialogTitle>
              <DialogDescription>
                Set up a new delivery round with rates and details.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="roundNumber">Round Number</Label>
                <Input
                  id="roundNumber"
                  value={formData.roundNumber}
                  onChange={(e) => handleInputChange('roundNumber', e.target.value)}
                  placeholder="e.g. R001, North Route"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Describe the round area and key locations"
                  rows={3}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="baseRate">Base Rate (£)</Label>
                  <Input
                    id="baseRate"
                    type="number"
                    step="0.01"
                    value={formData.baseRate}
                    onChange={(e) => handleInputChange('baseRate', e.target.value)}
                    placeholder="Daily base rate"
                  />
                </div>
                <div>
                  <Label htmlFor="parcelRate">Parcel Rate (£)</Label>
                  <Input
                    id="parcelRate"
                    type="number"
                    step="0.01"
                    value={formData.parcelRate}
                    onChange={(e) => handleInputChange('parcelRate', e.target.value)}
                    placeholder="Per parcel rate"
                  />
                </div>
              </div>
              
              <Button type="submit" className="w-full" disabled={addRoundMutation.isPending}>
                <MapPin className="h-4 w-4 mr-2" />
                {addRoundMutation.isPending ? 'Creating...' : 'Create Round'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Rounds</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rounds?.length || 0}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Base Rate</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              £{rounds?.length ? 
                (rounds.reduce((sum, round) => sum + (round.base_rate || 0), 0) / rounds.length).toFixed(2) 
                : '0.00'}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Parcel Rate</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              £{rounds?.length ? 
                (rounds.reduce((sum, round) => sum + (round.parcel_rate || 0), 0) / rounds.length).toFixed(2) 
                : '0.00'}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Delivery Rounds</CardTitle>
          <CardDescription>Configure your delivery routes and rates</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Round Number</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Base Rate</TableHead>
                <TableHead>Parcel Rate</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rounds?.map((round) => (
                <TableRow key={round.id}>
                  <TableCell className="font-medium">{round.round_number}</TableCell>
                  <TableCell>
                    <div className="max-w-xs truncate">
                      {round.description || '-'}
                    </div>
                  </TableCell>
                  <TableCell>
                    {round.base_rate ? `£${round.base_rate}` : '-'}
                  </TableCell>
                  <TableCell>
                    {round.parcel_rate ? `£${round.parcel_rate}` : '-'}
                  </TableCell>
                  <TableCell>
                    {new Date(round.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm">
                        <Settings className="h-3 w-3" />
                      </Button>
                      <Button variant="outline" size="sm">
                        Edit
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {rounds?.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No rounds configured. Create your first delivery round to get started.
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

export default RoundManagement;