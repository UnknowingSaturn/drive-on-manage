import React from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ReprocessButtonProps {
  reportId: string;
  screenshotPath: string;
  type: 'sod' | 'eod';
  size?: 'sm' | 'default';
  variant?: 'outline' | 'default' | 'secondary';
}

export const ReprocessButton: React.FC<ReprocessButtonProps> = ({ 
  reportId, 
  screenshotPath, 
  type, 
  size = 'sm',
  variant = 'outline'
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const reprocessMutation = useMutation({
    mutationFn: async () => {
      // First update the report status to processing
      const tableName = type === 'sod' ? 'start_of_day_reports' : 'end_of_day_reports';
      const { error: updateError } = await supabase
        .from(tableName)
        .update({ 
          processing_status: 'processing',
          updated_at: new Date().toISOString()
        })
        .eq('id', reportId);

      if (updateError) throw updateError;

      // Call the appropriate vision OCR function
      const functionName = type === 'sod' ? 'sod-vision-ocr' : 'eod-vision-ocr';
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: {
          screenshotPath: screenshotPath,
          reportId: reportId
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Reprocessing started",
        description: `The ${type.toUpperCase()} report is being reprocessed through Google Vision API.`,
      });
      // Invalidate queries to refresh the data
      queryClient.invalidateQueries({ queryKey: [`${type}-reports`] });
    },
    onError: (error: any) => {
      toast({
        title: "Error reprocessing report",
        description: error.message || "Failed to reprocess the report.",
        variant: "destructive",
      });
      
      // Reset the processing status on error
      const tableName = type === 'sod' ? 'start_of_day_reports' : 'end_of_day_reports';
      supabase
        .from(tableName)
        .update({ 
          processing_status: 'failed',
          updated_at: new Date().toISOString()
        })
        .eq('id', reportId)
        .then(() => {
          queryClient.invalidateQueries({ queryKey: [`${type}-reports`] });
        });
    }
  });

  const handleReprocess = () => {
    if (!screenshotPath) {
      toast({
        title: "No screenshot available",
        description: "This report doesn't have a screenshot to reprocess.",
        variant: "destructive",
      });
      return;
    }

    reprocessMutation.mutate();
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleReprocess}
      disabled={reprocessMutation.isPending || !screenshotPath}
      title={`Reprocess ${type.toUpperCase()} report through Google Vision API`}
    >
      <RefreshCw className={`h-4 w-4 ${reprocessMutation.isPending ? 'animate-spin' : ''} ${size !== 'sm' ? 'mr-2' : ''}`} />
      {size !== 'sm' && (reprocessMutation.isPending ? 'Reprocessing...' : 'Reprocess')}
    </Button>
  );
};