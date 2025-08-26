import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SODEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  report: any;
}

export const SODEditModal: React.FC<SODEditModalProps> = ({ open, onOpenChange, report }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    driver_name: '',
    round_number: '',
    extracted_round_number: '',
    heavy_parcels: 0,
    standard: 0,
    hanging_garments: 0,
    packets: 0,
    small_packets: 0,
    postables: 0,
    total_deliveries: 0,
    total_collections: 0,
    processing_status: 'pending'
  });

  useEffect(() => {
    if (report) {
      setFormData({
        driver_name: report.driver_name || '',
        round_number: report.round_number || '',
        extracted_round_number: report.extracted_round_number || '',
        heavy_parcels: report.heavy_parcels || 0,
        standard: report.standard || 0,
        hanging_garments: report.hanging_garments || 0,
        packets: report.packets || 0,
        small_packets: report.small_packets || 0,
        postables: report.postables || 0,
        total_deliveries: report.total_deliveries || 0,
        total_collections: report.total_collections || 0,
        processing_status: report.processing_status || 'pending'
      });
    }
  }, [report]);

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase
        .from('start_of_day_reports')
        .update({
          driver_name: data.driver_name,
          round_number: data.round_number,
          extracted_round_number: data.extracted_round_number,
          heavy_parcels: parseInt(data.heavy_parcels.toString()) || 0,
          standard: parseInt(data.standard.toString()) || 0,
          hanging_garments: parseInt(data.hanging_garments.toString()) || 0,
          packets: parseInt(data.packets.toString()) || 0,
          small_packets: parseInt(data.small_packets.toString()) || 0,
          postables: parseInt(data.postables.toString()) || 0,
          total_deliveries: parseInt(data.total_deliveries.toString()) || 0,
          total_collections: parseInt(data.total_collections.toString()) || 0,
          processing_status: data.processing_status,
          updated_at: new Date().toISOString()
        })
        .eq('id', report.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Report updated successfully",
        description: "The SOD report has been updated.",
      });
      queryClient.invalidateQueries({ queryKey: ['sod-reports'] });
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

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit SOD Report</DialogTitle>
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
              <Label htmlFor="round_number">Round Number</Label>
              <Input
                id="round_number"
                value={formData.round_number}
                onChange={(e) => handleInputChange('round_number', e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="extracted_round_number">Detected Round</Label>
              <Input
                id="extracted_round_number"
                value={formData.extracted_round_number}
                onChange={(e) => handleInputChange('extracted_round_number', e.target.value)}
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
            <h3 className="font-medium text-sm">Parcel Counts</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="heavy_parcels">Heavy Parcels</Label>
                <Input
                  id="heavy_parcels"
                  type="number"
                  min="0"
                  value={formData.heavy_parcels}
                  onChange={(e) => handleInputChange('heavy_parcels', parseInt(e.target.value) || 0)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="standard">Standard</Label>
                <Input
                  id="standard"
                  type="number"
                  min="0"
                  value={formData.standard}
                  onChange={(e) => handleInputChange('standard', parseInt(e.target.value) || 0)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="hanging_garments">Hanging Garments</Label>
                <Input
                  id="hanging_garments"
                  type="number"
                  min="0"
                  value={formData.hanging_garments}
                  onChange={(e) => handleInputChange('hanging_garments', parseInt(e.target.value) || 0)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="packets">Packets</Label>
                <Input
                  id="packets"
                  type="number"
                  min="0"
                  value={formData.packets}
                  onChange={(e) => handleInputChange('packets', parseInt(e.target.value) || 0)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="small_packets">Small Packets</Label>
                <Input
                  id="small_packets"
                  type="number"
                  min="0"
                  value={formData.small_packets}
                  onChange={(e) => handleInputChange('small_packets', parseInt(e.target.value) || 0)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="postables">Postables</Label>
                <Input
                  id="postables"
                  type="number"
                  min="0"
                  value={formData.postables}
                  onChange={(e) => handleInputChange('postables', parseInt(e.target.value) || 0)}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="total_deliveries">Total Deliveries</Label>
              <Input
                id="total_deliveries"
                type="number"
                min="0"
                value={formData.total_deliveries}
                onChange={(e) => handleInputChange('total_deliveries', parseInt(e.target.value) || 0)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="total_collections">Total Collections</Label>
              <Input
                id="total_collections"
                type="number"
                min="0"
                value={formData.total_collections}
                onChange={(e) => handleInputChange('total_collections', parseInt(e.target.value) || 0)}
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