import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, Edit, DollarSign, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { Label } from '@/components/ui/label';

const COST_CATEGORIES = [
  'fuel',
  'insurance',
  'maintenance',
  'admin_wages',
  'miscellaneous'
];

export const OperatingCosts = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingCost, setEditingCost] = useState<any>(null);
  const [formData, setFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    category: '',
    description: '',
    amount: ''
  });

  // Fetch operating costs
  const { data: costs = [], isLoading } = useQuery({
    queryKey: ['operating-costs', profile?.company_id, selectedMonth.toISOString()],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      
      const { data, error } = await supabase
        .from('operating_costs')
        .select('*')
        .eq('company_id', profile.company_id)
        .gte('date', format(startOfMonth(selectedMonth), 'yyyy-MM-dd'))
        .lte('date', format(endOfMonth(selectedMonth), 'yyyy-MM-dd'))
        .order('date', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.company_id
  });

  // Add/Update cost mutation
  const saveCostMutation = useMutation({
    mutationFn: async (costData: any) => {
      if (editingCost) {
        const { error } = await (supabase as any)
          .from('operating_costs')
          .update({
            date: costData.date,
            category: costData.category,
            description: costData.description,
            amount: parseFloat(costData.amount)
          })
          .eq('id', editingCost.id);
        
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from('operating_costs')
          .insert([{
            company_id: profile?.company_id,
            date: costData.date,
            category: costData.category,
            description: costData.description,
            amount: parseFloat(costData.amount),
            created_by: profile?.user_id
          }]);
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: editingCost ? "Cost updated" : "Cost added",
        description: editingCost ? "Operating cost has been updated successfully." : "New operating cost has been added.",
      });
      queryClient.invalidateQueries({ queryKey: ['operating-costs'] });
      setIsAddDialogOpen(false);
      setEditingCost(null);
      setFormData({
        date: format(new Date(), 'yyyy-MM-dd'),
        category: '',
        description: '',
        amount: ''
      });
    },
    onError: (error: any) => {
      toast({
        title: editingCost ? "Error updating cost" : "Error adding cost",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete cost mutation
  const deleteCostMutation = useMutation({
    mutationFn: async (costId: string) => {
      const { error } = await (supabase as any)
        .from('operating_costs')
        .delete()
        .eq('id', costId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Cost deleted",
        description: "Operating cost has been deleted successfully.",
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

  const navigateMonth = (direction: 'prev' | 'next') => {
    setSelectedMonth(prev => direction === 'prev' ? subMonths(prev, 1) : subMonths(prev, -1));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.date || !formData.category || !formData.description || !formData.amount) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    saveCostMutation.mutate(formData);
  };

  const startEdit = (cost: any) => {
    setEditingCost(cost);
    setFormData({
      date: cost.date,
      category: cost.category,
      description: cost.description,
      amount: cost.amount.toString()
    });
    setIsAddDialogOpen(true);
  };

  const cancelEdit = () => {
    setEditingCost(null);
    setFormData({
      date: format(new Date(), 'yyyy-MM-dd'),
      category: '',
      description: '',
      amount: ''
    });
    setIsAddDialogOpen(false);
  };

  // Calculate statistics
  const stats = React.useMemo(() => {
    const totalCosts = costs.reduce((sum, cost) => sum + cost.amount, 0);
    const costsByCategory = costs.reduce((acc, cost) => {
      acc[cost.category] = (acc[cost.category] || 0) + cost.amount;
      return acc;
    }, {} as Record<string, number>);
    
    return { totalCosts, costsByCategory };
  }, [costs]);

  const formatCategoryName = (category: string) => {
    return category.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p>Loading operating costs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Operating Costs</h2>
          <p className="text-muted-foreground">Track and manage operational expenses</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={() => navigateMonth('prev')}>←</Button>
          <div className="text-sm font-medium min-w-[150px] text-center">
            {format(selectedMonth, 'MMM yyyy')}
          </div>
          <Button variant="outline" onClick={() => navigateMonth('next')}>→</Button>
          
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingCost(null)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Cost
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingCost ? 'Edit Operating Cost' : 'Add Operating Cost'}</DialogTitle>
                <DialogDescription>
                  {editingCost ? 'Update the operating cost details' : 'Add a new operating cost entry'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Select value={formData.category} onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {COST_CATEGORIES.map((category) => (
                        <SelectItem key={category} value={category}>
                          {formatCategoryName(category)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe the expense..."
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="amount">Amount (£)</Label>
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
                
                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={cancelEdit}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saveCostMutation.isPending}>
                    {editingCost ? 'Update' : 'Add'} Cost
                  </Button>
                </div>
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
            <div className="text-2xl font-bold">£{stats.totalCosts.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              {format(selectedMonth, 'MMMM yyyy')}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Number of Entries</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{costs.length}</div>
            <p className="text-xs text-muted-foreground">
              cost entries
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Daily Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              £{costs.length > 0 ? (stats.totalCosts / costs.length).toFixed(2) : '0.00'}
            </div>
            <p className="text-xs text-muted-foreground">
              per entry
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Costs by Category */}
      <Card>
        <CardHeader>
          <CardTitle>Costs by Category</CardTitle>
          <CardDescription>
            Breakdown of operating costs for {format(selectedMonth, 'MMMM yyyy')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {COST_CATEGORIES.map((category) => (
              <div key={category} className="p-4 border rounded-lg">
                <h4 className="font-medium">{formatCategoryName(category)}</h4>
                <p className="text-2xl font-bold text-primary">
                  £{(stats.costsByCategory[category] || 0).toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Operating Costs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Operating Costs</CardTitle>
          <CardDescription>
            Detailed list of operating costs for {format(selectedMonth, 'MMMM yyyy')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
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
                {costs.map((cost) => (
                  <TableRow key={cost.id}>
                    <TableCell>{format(new Date(cost.date), 'dd/MM/yyyy')}</TableCell>
                    <TableCell>{formatCategoryName(cost.category)}</TableCell>
                    <TableCell>{cost.description}</TableCell>
                    <TableCell className="font-semibold">£{cost.amount.toFixed(2)}</TableCell>
                    <TableCell>
                      <div className="flex space-x-1">
                        <Button size="sm" variant="outline" onClick={() => startEdit(cost)}>
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
                ))}
              </TableBody>
            </Table>
          </div>
          
          {costs.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">No operating costs</h3>
              <p>Add your first operating cost to get started.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};