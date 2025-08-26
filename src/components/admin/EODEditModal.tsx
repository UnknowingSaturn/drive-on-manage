import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface EODEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  report: any;
}

export const EODEditModal: React.FC<EODEditModalProps> = ({ open, onOpenChange, report }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    driver_name: '',
    round1_number: '',
    round2_number: '',
    round3_number: '',
    round4_number: '',
    support: false,
    support_parcels: 0,
    successful_deliveries: 0,
    successful_collections: 0,
    company_van: false,
    van_registration: '',
    processing_status: 'pending'
  });

  useEffect(() => {
    if (report) {
      setFormData({
        driver_name: report.driver_name || '',
        round1_number: report.round1_number || '',
        round2_number: report.round2_number || '',
        round3_number: report.round3_number || '',
        round4_number: report.round4_number || '',
        support: report.support || false,
        support_parcels: report.support_parcels || 0,
        successful_deliveries: report.successful_deliveries || 0,
        successful_collections: report.successful_collections || 0,
        company_van: report.company_van || false,
        van_registration: report.van_registration || '',
        processing_status: report.processing_status || 'pending'
      });
    }
  }, [report]);

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase
        .from('end_of_day_reports')
        .update({
          driver_name: data.driver_name,
          round1_number: data.round1_number,
          round2_number: data.round2_number,
          round3_number: data.round3_number,
          round4_number: data.round4_number,
          support: data.support,
          support_parcels: parseInt(data.support_parcels.toString()) || 0,
          successful_deliveries: parseInt(data.successful_deliveries.toString()) || 0,
          successful_collections: parseInt(data.successful_collections.toString()) || 0,
          company_van: data.company_van,
          van_registration: data.van_registration,
          processing_status: data.processing_status,
          updated_at: new Date().toISOString()
        })
        .eq('id', report.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Report updated successfully",
        description: "The EOD report has been updated.",
      });
      queryClient.invalidateQueries({ queryKey: ['eod-reports'] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error updating report",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  const handleInputChange = (field: string, value: string | number | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit EOD Report</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="driver_name">Driver Name</Label>
              <Input
                id="driver_name"
                value={formData.driver_name}
                onChange={(e) => handleInputChange('driver_name', e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="processing_status">Processing Status</Label>
              <Select value={formData.processing_status} onValueChange={(value) => handleInputChange('processing_status', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-medium text-sm">Round Numbers</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="round1_number">Round 1</Label>
                <Input
                  id="round1_number"
                  value={formData.round1_number}
                  onChange={(e) => handleInputChange('round1_number', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="round2_number">Round 2</Label>
                <Input
                  id="round2_number"
                  value={formData.round2_number}
                  onChange={(e) => handleInputChange('round2_number', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="round3_number">Round 3</Label>
                <Input
                  id="round3_number"
                  value={formData.round3_number}
                  onChange={(e) => handleInputChange('round3_number', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="round4_number">Round 4</Label>
                <Input
                  id="round4_number"
                  value={formData.round4_number}
                  onChange={(e) => handleInputChange('round4_number', e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="successful_deliveries">Successful Deliveries</Label>
              <Input
                id="successful_deliveries"
                type="number"
                min="0"
                value={formData.successful_deliveries}
                onChange={(e) => handleInputChange('successful_deliveries', parseInt(e.target.value) || 0)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="successful_collections">Successful Collections</Label>
              <Input
                id="successful_collections"
                type="number"
                min="0"
                value={formData.successful_collections}
                onChange={(e) => handleInputChange('successful_collections', parseInt(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-medium text-sm">Support Work</h3>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="support"
                checked={formData.support}
                onCheckedChange={(checked) => handleInputChange('support', checked as boolean)}
              />
              <Label htmlFor="support">Did support work</Label>
            </div>
            
            {formData.support && (
              <div className="space-y-2">
                <Label htmlFor="support_parcels">Support Parcels</Label>
                <Input
                  id="support_parcels"
                  type="number"
                  min="0"
                  value={formData.support_parcels}
                  onChange={(e) => handleInputChange('support_parcels', parseInt(e.target.value) || 0)}
                />
              </div>
            )}
          </div>

          <div className="space-y-4">
            <h3 className="font-medium text-sm">Van Information</h3>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="company_van"
                checked={formData.company_van}
                onCheckedChange={(checked) => handleInputChange('company_van', checked as boolean)}
              />
              <Label htmlFor="company_van">Used company van</Label>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="van_registration">Van Registration</Label>
              <Input
                id="van_registration"
                value={formData.van_registration}
                onChange={(e) => handleInputChange('van_registration', e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};