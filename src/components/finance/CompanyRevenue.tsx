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
import { DollarSign, Plus, Calendar, Edit, Trash2, Package, TrendingUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth } from 'date-fns';

const PARCEL_TYPES = [
  { id: 'standard', name: 'Standard Parcels' },
  { id: 'express', name: 'Express Delivery' },
  { id: 'premium', name: 'Premium Service' },
  { id: 'collection', name: 'Collections' },
  { id: 'return', name: 'Returns' }
];

interface CompanyRevenueRecord {
  id: string;
  company_id: string;
  parcel_type: string;
  description?: string;
  rate_per_parcel: number;
  quantity: number;
  total_amount: number;
  date: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export const CompanyRevenue = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  });
  const [formData, setFormData] = useState({
    parcel_type: '',
    description: '',
    rate_per_parcel: '',
    quantity: '',
    date: format(new Date(), 'yyyy-MM-dd')
  });

  // Use the new company_revenue table 
  const { data: revenues = [], isLoading } = useQuery({
    queryKey: ['company-revenue', profile?.company_id, selectedPeriod],
    queryFn: async (): Promise<CompanyRevenueRecord[]> => {
      if (!profile?.company_id) return [];
      
      const { data, error }: { data: any; error: any } = await supabase
        .from('company_revenue' as any)
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

  // Add revenue mutation
  const addRevenueMutation = useMutation({
    mutationFn: async (revenueData: typeof formData) => {
      if (!profile?.company_id) throw new Error('No company ID');
      
      const totalAmount = parseFloat(revenueData.rate_per_parcel) * parseInt(revenueData.quantity);
      
      const { data, error } = await supabase
        .from('company_revenue' as any)
        .insert({
          company_id: profile.company_id,
          created_by: profile.user_id,
          parcel_type: revenueData.parcel_type,
          description: revenueData.description,
          rate_per_parcel: parseFloat(revenueData.rate_per_parcel),
          quantity: parseInt(revenueData.quantity),
          total_amount: totalAmount,
          date: revenueData.date
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Revenue recorded successfully",
        description: "The company revenue entry has been added.",
      });
      setIsDialogOpen(false);
      setFormData({
        parcel_type: '',
        description: '',
        rate_per_parcel: '',
        quantity: '',
        date: format(new Date(), 'yyyy-MM-dd')
      });
      queryClient.invalidateQueries({ queryKey: ['company-revenue'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error adding revenue",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addRevenueMutation.mutate(formData);
  };

  const totalRevenue = revenues.reduce((sum, rev) => sum + rev.total_amount, 0);
  const totalParcels = revenues.reduce((sum, rev) => sum + rev.quantity, 0);
  const averageRate = totalParcels > 0 ? totalRevenue / totalParcels : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Company Revenue</h2>
          <p className="text-muted-foreground">Track revenue from parcel deliveries and services</p>
        </div>

        {/* Period Selection */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="rev-period-start">From:</Label>
            <Input
              id="rev-period-start"
              type="date"
              value={selectedPeriod.start}
              onChange={(e) => setSelectedPeriod(prev => ({ ...prev, start: e.target.value }))}
              className="w-auto"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="rev-period-end">To:</Label>
            <Input
              id="rev-period-end"
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
                Add Revenue
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Company Revenue</DialogTitle>
                <DialogDescription>
                  Record revenue from parcel deliveries and services.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="parcel-type">Parcel Type *</Label>
                  <Select 
                    value={formData.parcel_type} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, parcel_type: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select parcel type" />
                    </SelectTrigger>
                    <SelectContent>
                      {PARCEL_TYPES.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name}
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
                    placeholder="Optional description"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="rate">Rate per Parcel (£) *</Label>
                    <Input
                      id="rate"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.rate_per_parcel}
                      onChange={(e) => setFormData(prev => ({ ...prev, rate_per_parcel: e.target.value }))}
                      placeholder="0.00"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="quantity">Quantity *</Label>
                    <Input
                      id="quantity"
                      type="number"
                      min="1"
                      value={formData.quantity}
                      onChange={(e) => setFormData(prev => ({ ...prev, quantity: e.target.value }))}
                      placeholder="0"
                      required
                    />
                  </div>
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
                
                {formData.rate_per_parcel && formData.quantity && (
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm font-medium">Total: £{(parseFloat(formData.rate_per_parcel || '0') * parseInt(formData.quantity || '0')).toFixed(2)}</p>
                  </div>
                )}
                
                <Button type="submit" className="w-full" disabled={addRevenueMutation.isPending}>
                  {addRevenueMutation.isPending ? 'Adding...' : 'Add Revenue'}
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
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">£{totalRevenue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">{revenues.length} entries</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Parcels</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalParcels}</div>
            <p className="text-xs text-muted-foreground">in selected period</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">£{averageRate.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">per parcel</p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Table */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue Entries</CardTitle>
          <CardDescription>
            Company revenue for the selected period
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p>Loading revenue data...</p>
            </div>
          ) : revenues.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No revenue entries found for the selected period.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Parcel Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {revenues.map((revenue) => {
                  const parcelType = PARCEL_TYPES.find(type => type.id === revenue.parcel_type);
                  return (
                    <TableRow key={revenue.id}>
                      <TableCell>
                        {new Date(revenue.date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Package className="h-4 w-4 text-primary" />
                          <span>{parcelType?.name || revenue.parcel_type}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {revenue.description || '-'}
                      </TableCell>
                      <TableCell className="font-medium">
                        £{revenue.rate_per_parcel.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        {revenue.quantity}
                      </TableCell>
                      <TableCell className="font-bold">
                        £{revenue.total_amount.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};