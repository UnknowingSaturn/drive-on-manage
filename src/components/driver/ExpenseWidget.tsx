import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Receipt, Eye, Plus, DollarSign } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

const ExpenseWidget = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [quickExpense, setQuickExpense] = useState({
    type: '',
    amount: ''
  });

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

  // Fetch recent expenses summary
  const { data: expensesSummary } = useQuery({
    queryKey: ['expenses-summary', driverProfile?.id],
    queryFn: async () => {
      if (!driverProfile?.id) return null;
      
      const today = new Date().toISOString().split('T')[0];
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('driver_expenses')
        .select('*')
        .eq('driver_id', driverProfile.id)
        .gte('expense_date', weekAgo)
        .order('expense_date', { ascending: false });

      if (error) throw error;
      
      const todayExpenses = data.filter(exp => exp.expense_date === today);
      const weekTotal = data.reduce((sum, exp) => sum + (exp.amount || 0), 0);
      const todayTotal = todayExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
      
      return {
        todayTotal,
        weekTotal,
        recentCount: data.length,
        pendingCount: data.filter(exp => !exp.is_approved).length
      };
    },
    enabled: !!driverProfile?.id
  });

  // Quick expense submission
  const submitQuickExpense = useMutation({
    mutationFn: async () => {
      if (!driverProfile?.id || !quickExpense.type || !quickExpense.amount) return;
      
      const { error } = await supabase
        .from('driver_expenses')
        .insert({
          driver_id: driverProfile.id,
          company_id: driverProfile.company_id,
          expense_type: quickExpense.type,
          amount: parseFloat(quickExpense.amount),
          description: `Quick ${quickExpense.type} expense`,
          expense_date: new Date().toISOString().split('T')[0],
          is_approved: false
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Expense added",
        description: "Your expense has been recorded successfully.",
      });
      setQuickExpense({ type: '', amount: '' });
      queryClient.invalidateQueries({ queryKey: ['expenses-summary'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add expense. Please try again.",
        variant: "destructive",
      });
    }
  });

  return (
    <Card className="logistics-card bg-gradient-subtle">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Receipt className="h-5 w-5 text-purple-600" />
            <CardTitle className="text-lg">Expenses</CardTitle>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/driver/expenses')}>
            <Eye className="h-4 w-4" />
          </Button>
        </div>
        <CardDescription>Track your expenses</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {expensesSummary && (
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-lg font-semibold text-gradient">
                £{expensesSummary.todayTotal.toFixed(2)}
              </div>
              <div className="text-xs text-muted-foreground">Today</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-purple-600">
                £{expensesSummary.weekTotal.toFixed(2)}
              </div>
              <div className="text-xs text-muted-foreground">This Week</div>
            </div>
          </div>
        )}
        
        <div className="space-y-3">
          <div className="text-sm font-medium flex items-center">
            <Plus className="h-4 w-4 mr-1" />
            Quick Add Expense
          </div>
          
          <div className="space-y-2">
            <Select value={quickExpense.type} onValueChange={(value) => setQuickExpense(prev => ({ ...prev, type: value }))}>
              <SelectTrigger className="h-8">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fuel">Fuel</SelectItem>
                <SelectItem value="parking">Parking</SelectItem>
                <SelectItem value="food">Food</SelectItem>
                <SelectItem value="tolls">Tolls</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
              </SelectContent>
            </Select>
            
            <div className="flex space-x-2">
              <Input
                placeholder="Amount"
                type="number"
                step="0.01"
                value={quickExpense.amount}
                onChange={(e) => setQuickExpense(prev => ({ ...prev, amount: e.target.value }))}
                className="h-8"
              />
              <Button 
                size="sm"
                disabled={!quickExpense.type || !quickExpense.amount || submitQuickExpense.isPending}
                onClick={() => submitQuickExpense.mutate()}
              >
                Add
              </Button>
            </div>
          </div>
          
          {expensesSummary && expensesSummary.pendingCount > 0 && (
            <div className="text-xs text-warning text-center">
              {expensesSummary.pendingCount} expenses awaiting approval
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ExpenseWidget;