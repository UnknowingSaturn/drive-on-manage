import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Fuel, Shield, Wrench, Users, Package } from 'lucide-react';

const COST_CATEGORIES = [
  { id: 'fuel', name: 'Fuel', icon: Fuel },
  { id: 'insurance', name: 'Insurance', icon: Shield },
  { id: 'maintenance', name: 'Maintenance', icon: Wrench },
  { id: 'admin_wages', name: 'Admin Wages', icon: Users },
  { id: 'miscellaneous', name: 'Miscellaneous', icon: Package }
];

interface CostEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cost: {
    id: string;
    category: string;
    description: string;
    amount: number;
    date: string;
  } | null;
  onSave: (updatedCost: any) => void;
  isLoading?: boolean;
}

export const CostEditModal: React.FC<CostEditModalProps> = ({
  open,
  onOpenChange,
  cost,
  onSave,
  isLoading = false
}) => {
  const [formData, setFormData] = useState({
    category: '',
    description: '',
    amount: '',
    date: ''
  });

  useEffect(() => {
    if (cost) {
      setFormData({
        category: cost.category,
        description: cost.description,
        amount: cost.amount.toString(),
        date: cost.date
      });
    }
  }, [cost]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (cost) {
      onSave({
        ...cost,
        category: formData.category,
        description: formData.description,
        amount: parseFloat(formData.amount),
        date: formData.date
      });
    }
  };

  if (!cost) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Operating Cost</DialogTitle>
          <DialogDescription>
            Update the details of this operating expense.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="edit-category">Category *</Label>
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
                    <div className="flex items-center space-x-2">
                      <category.icon className="h-4 w-4" />
                      <span>{category.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="edit-description">Description *</Label>
            <Textarea
              id="edit-description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe the expense"
              required
            />
          </div>
          
          <div>
            <Label htmlFor="edit-amount">Amount (£) *</Label>
            <Input
              id="edit-amount"
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
            <Label htmlFor="edit-date">Date *</Label>
            <Input
              id="edit-date"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
              required
            />
          </div>
          
          <div className="flex justify-end space-x-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};