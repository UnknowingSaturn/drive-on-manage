import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, MapPin, DollarSign, Settings, X, Route, Edit, Trash2 } from 'lucide-react';
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
  const [editingRound, setEditingRound] = useState<any>(null);
  const [formData, setFormData] = useState({
    roundNumber: '',
    locations: '',
    parcelRate: '',
    routeRate: '',
    roadLists: ['']
  });
  const [newRoad, setNewRoad] = useState('');

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
          description: roundData.locations,
          parcel_rate: roundData.parcelRate ? parseFloat(roundData.parcelRate) : null,
          rate: roundData.routeRate ? parseFloat(roundData.routeRate) : null,
          road_lists: roundData.roadLists.filter(road => road.trim() !== ''),
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
        locations: '',
        parcelRate: '',
        routeRate: '',
        roadLists: ['']
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

  // Update round mutation
  const updateRoundMutation = useMutation({
    mutationFn: async (roundData: typeof formData & { id: string }) => {
      const { error } = await supabase
        .from('rounds')
        .update({
          round_number: roundData.roundNumber,
          description: roundData.locations,
          parcel_rate: roundData.parcelRate ? parseFloat(roundData.parcelRate) : null,
          rate: roundData.routeRate ? parseFloat(roundData.routeRate) : null,
          road_lists: roundData.roadLists.filter(road => road.trim() !== ''),
        })
        .eq('id', roundData.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Round updated successfully",
        description: "The delivery round has been updated.",
      });
      setIsDialogOpen(false);
      setEditingRound(null);
      setFormData({
        roundNumber: '',
        locations: '',
        parcelRate: '',
        routeRate: '',
        roadLists: ['']
      });
      queryClient.invalidateQueries({ queryKey: ['rounds'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating round",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete round mutation
  const deleteRoundMutation = useMutation({
    mutationFn: async (roundId: string) => {
      const { error } = await supabase
        .from('rounds')
        .update({ is_active: false })
        .eq('id', roundId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Round deleted successfully",
        description: "The delivery round has been deactivated.",
      });
      queryClient.invalidateQueries({ queryKey: ['rounds'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error deleting round",
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
    if (editingRound) {
      updateRoundMutation.mutate({ ...formData, id: editingRound.id });
    } else {
      addRoundMutation.mutate(formData);
    }
  };

  const handleEditRound = (round: any) => {
    setEditingRound(round);
    setFormData({
      roundNumber: round.round_number || '',
      locations: round.description || '',
      parcelRate: round.parcel_rate?.toString() || '',
      routeRate: round.rate?.toString() || '',
      roadLists: round.road_lists?.length ? round.road_lists : ['']
    });
    setIsDialogOpen(true);
  };

  const handleDeleteRound = (round: any) => {
    if (confirm(`Are you sure you want to delete round ${round.round_number}? This action cannot be undone.`)) {
      deleteRoundMutation.mutate(round.id);
    }
  };

  const resetForm = () => {
    setEditingRound(null);
    setFormData({
      roundNumber: '',
      locations: '',
      parcelRate: '',
      routeRate: '',
      roadLists: ['']
    });
  };

  const addRoadToList = () => {
    if (newRoad.trim()) {
      setFormData(prev => ({
        ...prev,
        roadLists: [...prev.roadLists, newRoad.trim()]
      }));
      setNewRoad('');
    }
  };

  const removeRoadFromList = (index: number) => {
    setFormData(prev => ({
      ...prev,
      roadLists: prev.roadLists.filter((_, i) => i !== index)
    }));
  };

  const updateRoadInList = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      roadLists: prev.roadLists.map((road, i) => i === index ? value : road)
    }));
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
        
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Round
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{editingRound ? 'Edit Round' : 'Create New Round'}</DialogTitle>
              <DialogDescription>
                {editingRound ? 'Update the delivery round details.' : 'Set up a new delivery round with rates and details.'}
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
                <Label htmlFor="locations">Locations</Label>
                <Textarea
                  id="locations"
                  value={formData.locations}
                  onChange={(e) => handleInputChange('locations', e.target.value)}
                  placeholder="Describe the round area and key locations"
                  rows={3}
                />
              </div>
              
              <div>
                <Label htmlFor="routeRate">Route Parcel Rate (£)</Label>
                <Input
                  id="routeRate"
                  type="number"
                  step="0.01"
                  value={formData.routeRate}
                  onChange={(e) => handleInputChange('routeRate', e.target.value)}
                  placeholder="Per parcel rate for this route"
                />
              </div>
              
              <div>
                <Label>Road Lists</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Add roads in order for driver reference
                </p>
                <div className="space-y-2">
                  {formData.roadLists.map((road, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        value={road}
                        onChange={(e) => updateRoadInList(index, e.target.value)}
                        placeholder={`Road ${index + 1}`}
                        className="flex-1"
                      />
                      {formData.roadLists.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeRoadFromList(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Input
                      value={newRoad}
                      onChange={(e) => setNewRoad(e.target.value)}
                      placeholder="Add new road"
                      className="flex-1"
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addRoadToList())}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addRoadToList}
                      disabled={!newRoad.trim()}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
              
              <Button type="submit" className="w-full" disabled={addRoundMutation.isPending || updateRoundMutation.isPending}>
                <MapPin className="h-4 w-4 mr-2" />
                {addRoundMutation.isPending || updateRoundMutation.isPending ? 
                  (editingRound ? 'Updating...' : 'Creating...') : 
                  (editingRound ? 'Update Round' : 'Create Round')
                }
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
            <CardTitle className="text-sm font-medium">Avg Route Rate</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              £{rounds?.length ? 
                (rounds.reduce((sum, round) => sum + (round.rate || 0), 0) / rounds.length).toFixed(2) 
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
                <TableHead>Locations</TableHead>
                <TableHead>Road Lists</TableHead>
                <TableHead>Route Rate</TableHead>
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
                    <div className="max-w-xs">
                      {round.road_lists?.length ? (
                        <div className="space-y-1">
                          {round.road_lists.slice(0, 3).map((road: string, index: number) => (
                            <div key={index} className="text-xs flex items-center gap-1">
                              <Route className="h-3 w-3 text-muted-foreground" />
                              <span className="truncate">{road}</span>
                            </div>
                          ))}
                          {round.road_lists.length > 3 && (
                            <div className="text-xs text-muted-foreground">
                              +{round.road_lists.length - 3} more roads
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">No roads added</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {round.rate ? (
                      <div className="font-medium text-primary">
                        £{round.rate}/parcel
                        <div className="text-xs text-muted-foreground">
                          Overrides driver rates
                        </div>
                      </div>
                    ) : (
                      <div className="text-muted-foreground text-sm">
                        Uses driver base rates
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {new Date(round.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleEditRound(round)}
                        title="Edit round"
                        disabled={updateRoundMutation.isPending}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleDeleteRound(round)}
                        title="Delete round"
                        disabled={deleteRoundMutation.isPending}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
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