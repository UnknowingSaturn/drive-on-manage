import React, { useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Camera, Receipt, DollarSign, Upload, Download, Clock, CheckCircle, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const ExpenseTracker = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [expenseForm, setExpenseForm] = useState({
    type: '',
    amount: '',
    description: '',
    receiptFile: null as File | null
  });
  const [isUploading, setIsUploading] = useState(false);

  // Fetch driver profile
  const { data: driverProfile } = useQuery({
    queryKey: ['driver-profile', profile?.user_id],
    queryFn: async () => {
      if (!profile?.user_id) return null;
      
      const { data, error } = await supabase
        .from('driver_profiles')
        .select('*')
        .eq('user_id', profile.user_id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!profile?.user_id
  });

  // Fetch expenses
  const { data: expenses } = useQuery({
    queryKey: ['driver-expenses', driverProfile?.id],
    queryFn: async () => {
      if (!driverProfile?.id) return [];
      
      const { data, error } = await supabase
        .from('driver_expenses')
        .select('*')
        .eq('driver_id', driverProfile.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!driverProfile?.id
  });

  // Submit expense mutation
  const submitExpenseMutation = useMutation({
    mutationFn: async (expenseData: any) => {
      let receiptUrl = null;

      // Upload receipt if provided
      if (expenseData.receiptFile) {
        const fileExt = expenseData.receiptFile.name.split('.').pop();
        const fileName = `${driverProfile?.id}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('eod-screenshots')
          .upload(fileName, expenseData.receiptFile);

        if (uploadError) throw uploadError;
        
        const { data: urlData } = supabase.storage
          .from('eod-screenshots')
          .getPublicUrl(fileName);
        
        receiptUrl = urlData.publicUrl;
      }

      const { error } = await supabase
        .from('driver_expenses')
        .insert({
          driver_id: driverProfile?.id,
          company_id: driverProfile?.company_id,
          expense_type: expenseData.type,
          amount: parseFloat(expenseData.amount),
          description: expenseData.description,
          receipt_url: receiptUrl
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Expense submitted",
        description: "Your expense has been recorded and is pending approval.",
      });
      setExpenseForm({ type: '', amount: '', description: '', receiptFile: null });
      queryClient.invalidateQueries({ queryKey: ['driver-expenses'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error submitting expense",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setExpenseForm(prev => ({ ...prev, receiptFile: file }));
      toast({
        title: "Receipt attached",
        description: `${file.name} ready to upload`,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!expenseForm.type || !expenseForm.amount) {
      toast({
        title: "Please fill required fields",
        description: "Expense type and amount are required",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      await submitExpenseMutation.mutateAsync(expenseForm);
    } finally {
      setIsUploading(false);
    }
  };

  const getStatusBadge = (isApproved: boolean | null) => {
    if (isApproved === null) {
      return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    }
    if (isApproved) {
      return <Badge variant="default" className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
    }
    return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
  };

  const totalPendingExpenses = expenses?.filter(e => e.is_approved === null)
    .reduce((sum, e) => sum + Number(e.amount), 0) || 0;

  const totalApprovedExpenses = expenses?.filter(e => e.is_approved === true)
    .reduce((sum, e) => sum + Number(e.amount), 0) || 0;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Expense Tracker</h1>
        <p className="text-muted-foreground">Log fuel, tolls, parking and other business expenses</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Expenses</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">£{totalPendingExpenses.toFixed(2)}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved This Month</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">£{totalApprovedExpenses.toFixed(2)}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              £{((totalPendingExpenses + totalApprovedExpenses) || 0).toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Log New Expense</CardTitle>
          <CardDescription>
            Snap a photo of your receipt and record the expense details
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">Expense Type</Label>
                <Select 
                  value={expenseForm.type} 
                  onValueChange={(value) => setExpenseForm(prev => ({ ...prev, type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select expense type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fuel">Fuel</SelectItem>
                    <SelectItem value="tolls">Tolls</SelectItem>
                    <SelectItem value="parking">Parking</SelectItem>
                    <SelectItem value="maintenance">Vehicle Maintenance</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Amount (£)</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder="0.00"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={expenseForm.description}
                onChange={(e) => setExpenseForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of the expense..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Receipt Photo</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1"
                >
                  <Camera className="h-4 w-4 mr-2" />
                  {expenseForm.receiptFile ? expenseForm.receiptFile.name : 'Attach Receipt'}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full"
              disabled={isUploading || submitExpenseMutation.isPending}
            >
              <Receipt className="h-4 w-4 mr-2" />
              {isUploading ? 'Uploading...' : 'Log Expense'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Expense History</CardTitle>
            <CardDescription>Your submitted expenses and approval status</CardDescription>
          </div>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </CardHeader>
        <CardContent>
          {expenses?.length ? (
            <div className="space-y-4">
              {expenses.map((expense: any) => (
                <div key={expense.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <div className="font-medium capitalize">{expense.expense_type}</div>
                      {getStatusBadge(expense.is_approved)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {expense.description}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(expense.expense_date).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">£{Number(expense.amount).toFixed(2)}</div>
                    {expense.receipt_url && (
                      <Button variant="ghost" size="sm" asChild>
                        <a href={expense.receipt_url} target="_blank" rel="noopener noreferrer">
                          <Receipt className="h-3 w-3 mr-1" />
                          View
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No expenses logged yet</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ExpenseTracker;