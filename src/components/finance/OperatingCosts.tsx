import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DollarSign, Plus, Calendar, Edit, Trash2, TrendingUp, Fuel, Shield, Wrench, Users, Package } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { EditableCostCell } from './EditableCostCell';
import { CostEditModal } from './CostEditModal';

const COST_CATEGORIES = [
  { id: 'fuel', name: 'Fuel', icon: Fuel },
  { id: 'insurance', name: 'Insurance', icon: Shield },
  { id: 'maintenance', name: 'Maintenance', icon: Wrench },
  { id: 'admin_wages', name: 'Admin Wages', icon: Users },
  { id: 'miscellaneous', name: 'Miscellaneous', icon: Package }
];

export const OperatingCosts = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedCost, setSelectedCost] = useState<any>(null);
  const [selectedPeriod, setSelectedPeriod] = useState({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  });
  const [formData, setFormData] = useState({
    category: '',
    description: '',
    amount: '',
    date: format(new Date(), 'yyyy-MM-dd')
  });

  // Fetch operating costs
  const { data: operatingCosts = [], isLoading } = useQuery({
    queryKey: ['operating-costs', profile?.company_id, selectedPeriod],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      
      const { data, error } = await supabase
        .from('operating_costs')
        .select('*')
        .eq('company_id', profile.company_id)
        .gte('date', selectedPeriod.start)
        .lte('date', selectedPeriod.end)
        .order('date', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.company_id
  });

  // Add operating cost mutation
  const addCostMutation = useMutation({
    mutationFn: async (costData: typeof formData) => {
      if (!profile?.company_id) throw new Error('No company ID');
      
      const { data, error } = await supabase
        .from('operating_costs')
        .insert({
          company_id: profile.company_id,
          created_by: profile.user_id,
          category: costData.category,
          description: costData.description,
          amount: parseFloat(costData.amount),
          date: costData.date
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Cost added successfully",
        description: "The operating cost has been recorded.",
      });
      setIsDialogOpen(false);
      setFormData({
        category: '',
        description: '',
        amount: '',
        date: format(new Date(), 'yyyy-MM-dd')
      });
      queryClient.invalidateQueries({ queryKey: ['operating-costs'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error adding cost",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update cost mutation
  const updateCostMutation = useMutation({
    mutationFn: async (updatedCost: any) => {
      const { error } = await supabase
        .from('operating_costs')
        .update({
          category: updatedCost.category,
          description: updatedCost.description,
          amount: updatedCost.amount,
          date: updatedCost.date
        })
        .eq('id', updatedCost.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Cost updated successfully",
        description: "The operating cost has been updated.",
      });
      setIsEditModalOpen(false);
      setSelectedCost(null);
      queryClient.invalidateQueries({ queryKey: ['operating-costs'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating cost",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete cost mutation
  const deleteCostMutation = useMutation({
    mutationFn: async (costId: string) => {
      const { error } = await supabase
        .from('operating_costs')
        .delete()
        .eq('id', costId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Cost deleted",
        description: "The operating cost has been removed.",
      });
      queryClient.invalidateQueries({ queryKey: ['operating-costs'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error deleting cost",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle inline cell updates
  const handleCellUpdate = async (costId: string, field: string, value: any) => {
    try {
      const { error } = await supabase
        .from('operating_costs')
        .update({ [field]: value })
        .eq('id', costId);

      if (error) throw error;

      toast({
        title: "Cost updated",
        description: `${field} has been updated successfully.`,
      });

      queryClient.invalidateQueries({ queryKey: ['operating-costs'] });
    } catch (error: any) {
      toast({
        title: "Error updating cost",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEditCost = (cost: any) => {
    setSelectedCost(cost);
    setIsEditModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addCostMutation.mutate(formData);
  };

  const totalCosts = operatingCosts.reduce((sum, cost) => sum + cost.amount, 0);
  const averageDailyCost = operatingCosts.length > 0 ? totalCosts / operatingCosts.length : 0;

  // Calculate costs by category
  const costsByCategory = COST_CATEGORIES.map(category => {
    const categoryTotal = operatingCosts
      .filter(cost => cost.category === category.id)
      .reduce((sum, cost) => sum + cost.amount, 0);
    return { ...category, total: categoryTotal };
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Operating Costs</h2>
          <p className="text-muted-foreground">Track and manage operational expenses</p>
        </div>

        {/* Period Selection */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="period-start">From:</Label>
            <Input
              id="period-start"
              type="date"
              value={selectedPeriod.start}
              onChange={(e) => setSelectedPeriod(prev => ({ ...prev, start: e.target.value }))}
              className="w-auto"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="period-end">To:</Label>
            <Input
              id="period-end"
              type="date"
              value={selectedPeriod.end}
              onChange={(e) => setSelectedPeriod(prev => ({ ...prev, end: e.target.value }))}
              className="w-auto"
            />
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Cost
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Operating Cost</DialogTitle>
                <DialogDescription>
                  Record a new operational expense.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="category">Category *</Label>
                  <Select 
                    value={formData.category} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {COST_CATEGORIES.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe the expense"
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="amount">Amount (£) *</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.amount}
                    onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                    placeholder="0.00"
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="date">Date *</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                    required
                  />
                </div>
                
                <Button type="submit" className="w-full" disabled={addCostMutation.isPending}>
                  {addCostMutation.isPending ? 'Adding...' : 'Add Cost'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Costs</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">£{totalCosts.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">{operatingCosts.length} entries</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Number of Entries</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{operatingCosts.length}</div>
            <p className="text-xs text-muted-foreground">in selected period</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average per Entry</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">£{averageDailyCost.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">average cost</p>
          </CardContent>
        </Card>
      </div>

      {/* Costs by Category */}
      <Card>
        <CardHeader>
          <CardTitle>Cost Categories</CardTitle>
          <CardDescription>
            Expense breakdown by category for the selected period
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {costsByCategory.map((category) => {
              const IconComponent = category.icon;
              return (
                <div key={category.id} className="p-4 border rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <IconComponent className="h-4 w-4 text-primary" />
                    <h4 className="font-medium">{category.name}</h4>
                  </div>
                  <p className="text-2xl font-bold">£{category.total.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">
                    {operatingCosts.filter(cost => cost.category === category.id).length} entries
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Operating Costs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Operating Costs</CardTitle>
          <CardDescription>
            All operating expenses for the selected period
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p>Loading costs...</p>
            </div>
          ) : operatingCosts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No operating costs found for the selected period.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {operatingCosts.map((cost) => {
                  const category = COST_CATEGORIES.find(cat => cat.id === cost.category);
                  return (
                    <TableRow key={cost.id}>
                      <TableCell>
                        <EditableCostCell
                          value={cost.date}
                          onSave={(value) => handleCellUpdate(cost.id, 'date', value)}
                          type="date"
                          formatValue={(date) => new Date(date).toLocaleDateString()}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {category && <category.icon className="h-4 w-4 text-primary" />}
                          <span>{category?.name || cost.category}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <EditableCostCell
                          value={cost.description}
                          onSave={(value) => handleCellUpdate(cost.id, 'description', value)}
                          type="text"
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        <EditableCostCell
                          value={cost.amount}
                          onSave={(value) => handleCellUpdate(cost.id, 'amount', value)}
                          type="number"
                          step="0.01"
                          min="0"
                          formatValue={(amount) => `£${amount.toFixed(2)}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-1">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleEditCost(cost)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => deleteCostMutation.mutate(cost.id)}
                            disabled={deleteCostMutation.isPending}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Modal */}
      <CostEditModal
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        cost={selectedCost}
        onSave={(updatedCost) => updateCostMutation.mutate(updatedCost)}
        isLoading={updateCostMutation.isPending}
      />
    </div>
  );
};