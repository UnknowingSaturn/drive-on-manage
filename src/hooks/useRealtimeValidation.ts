import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface RealtimeValidationOptions {
  companyId?: string;
  driverId?: string;
  enableVehicleChecks?: boolean;
  enableDuplicateChecks?: boolean;
  enableParcelValidation?: boolean;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

interface VehicleAvailability {
  vehicleId: string;
  isAvailable: boolean;
  assignedDriver?: string;
  lastCheck?: string;
}

export function useRealtimeValidation(options: RealtimeValidationOptions = {}) {
  const [validationResults, setValidationResults] = useState<ValidationResult>({
    isValid: true,
    errors: [],
    warnings: []
  });
  const [vehicleAvailability, setVehicleAvailability] = useState<VehicleAvailability[]>([]);
  const { toast } = useToast();

  // Vehicle availability real-time validation
  const checkVehicleAvailability = useCallback(async (vehicleId: string) => {
    if (!options.enableVehicleChecks) return { isAvailable: true };

    try {
      
      // Check if vehicle is already assigned for today
      const today = new Date().toISOString().split('T')[0];
      
      const { data: sodLogs, error } = await supabase
        .from('sod_logs')
        .select('driver_id, van_id, log_date')
        .eq('van_id', vehicleId)
        .eq('log_date', today)
        .limit(1);

      if (error) {
        console.error('Vehicle availability check failed:', error);
        return { isAvailable: false, error: error.message };
      }

      const isAvailable = !sodLogs || sodLogs.length === 0;
      
      setVehicleAvailability(prev => {
        const updated = prev.filter(v => v.vehicleId !== vehicleId);
        return [...updated, {
          vehicleId,
          isAvailable,
          assignedDriver: sodLogs?.[0]?.driver_id,
          lastCheck: new Date().toISOString()
        }];
      });

      if (!isAvailable) {
        toast({
          title: "Vehicle Unavailable",
          description: `Vehicle ${vehicleId} is already assigned for today`,
          variant: "destructive"
        });
      }

      return { isAvailable, assignedDriver: sodLogs?.[0]?.driver_id };
    } catch (error) {
      console.error('Vehicle availability check error:', error);
      return { isAvailable: false, error: 'Failed to check vehicle availability' };
    }
  }, [options.enableVehicleChecks, toast]);

  // Check for duplicate SOD/EOD entries
  const checkDuplicateEntries = useCallback(async (driverId: string, entryType: 'sod' | 'eod') => {
    if (!options.enableDuplicateChecks) return { hasDuplicate: false };

    try {
      
      const today = new Date().toISOString().split('T')[0];
      const tableName = entryType === 'sod' ? 'sod_logs' : 'eod_reports';
      
      const { data: existingEntries, error } = await supabase
        .from(tableName)
        .select('id, log_date')
        .eq('driver_id', driverId)
        .eq('log_date', today);

      if (error) {
        console.error(`Duplicate ${entryType} check failed:`, error);
        return { hasDuplicate: false, error: error.message };
      }

      const hasDuplicate = existingEntries && existingEntries.length > 0;
      
      if (hasDuplicate) {
        const message = `Driver has already submitted ${entryType.toUpperCase()} for today`;
        toast({
          title: "Duplicate Entry Detected",
          description: message,
          variant: "destructive"
        });
        
        setValidationResults(prev => ({
          ...prev,
          isValid: false,
          errors: [...prev.errors.filter(e => !e.includes('duplicate')), message]
        }));
      }

      return { hasDuplicate };
    } catch (error) {
      console.error(`Duplicate ${entryType} check error:`, error);
      return { hasDuplicate: false, error: 'Failed to check for duplicates' };
    }
  }, [options.enableDuplicateChecks, toast]);

  // Validate parcel count consistency
  const validateParcelCounts = useCallback(async (driverId: string, deliveredCount: number) => {
    if (!options.enableParcelValidation) return { isValid: true };

    try {
      
      const today = new Date().toISOString().split('T')[0];
      
      // Get SOD parcel count
      const { data: sodData, error: sodError } = await supabase
        .from('sod_logs')
        .select('parcel_count')
        .eq('driver_id', driverId)
        .eq('log_date', today)
        .single();

      if (sodError) {
        console.error('SOD data fetch failed:', sodError);
        return { isValid: false, error: 'Failed to fetch SOD data' };
      }

      if (!sodData) {
        const message = 'No SOD entry found for today. Please complete Start of Day first.';
        toast({
          title: "SOD Required",
          description: message,
          variant: "destructive"
        });
        return { isValid: false, error: message };
      }

      const startingCount = sodData.parcel_count;
      const isValid = deliveredCount <= startingCount;
      
      if (!isValid) {
        const message = `Delivered count (${deliveredCount}) cannot exceed starting count (${startingCount})`;
        toast({
          title: "Parcel Count Mismatch",
          description: message,
          variant: "destructive"
        });
        
        setValidationResults(prev => ({
          ...prev,
          isValid: false,
          errors: [...prev.errors.filter(e => !e.includes('parcel')), message]
        }));
      } else if (deliveredCount < startingCount) {
        const undelivered = startingCount - deliveredCount;
        const warning = `${undelivered} parcels remain undelivered`;
        
        setValidationResults(prev => ({
          ...prev,
          warnings: [...prev.warnings.filter(w => !w.includes('undelivered')), warning]
        }));
        
        toast({
          title: "Undelivered Parcels",
          description: warning,
          variant: "default"
        });
      }

      return { isValid, startingCount, deliveredCount, undelivered: startingCount - deliveredCount };
    } catch (error) {
      console.error('Parcel validation error:', error);
      return { isValid: false, error: 'Failed to validate parcel counts' };
    }
  }, [options.enableParcelValidation, toast]);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!options.companyId) return;

    

    const subscriptions = [];

    // SOD logs subscription for vehicle availability
    if (options.enableVehicleChecks) {
      const sodSubscription = supabase
        .channel('sod-realtime-validation')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'sod_logs',
            filter: `company_id=eq.${options.companyId}`
          },
          (payload) => {
            
            if (payload.new && typeof payload.new === 'object' && 'van_id' in payload.new) {
              const newRecord = payload.new as { van_id: string; driver_id: string };
              
              // Vehicle assignment changed, update availability
              setVehicleAvailability(prev => {
                const updated = prev.filter(v => v.vehicleId !== newRecord.van_id);
                return [...updated, {
                  vehicleId: newRecord.van_id,
                  isAvailable: false,
                  assignedDriver: newRecord.driver_id,
                  lastCheck: new Date().toISOString()
                }];
              });
            }
          }
        )
        .subscribe();

      subscriptions.push(sodSubscription);
    }

    // EOD reports subscription for parcel validation
    if (options.enableParcelValidation) {
      const eodSubscription = supabase
        .channel('eod-realtime-validation')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'eod_reports',
            filter: `company_id=eq.${options.companyId}`
          },
          (payload) => {
            
            if (payload.new && typeof payload.new === 'object' && 'driver_id' in payload.new && 'parcels_delivered' in payload.new) {
              const newRecord = payload.new as { driver_id: string; parcels_delivered: number };
              // Validate parcel counts in real-time
              validateParcelCounts(newRecord.driver_id, newRecord.parcels_delivered);
            }
          }
        )
        .subscribe();

      subscriptions.push(eodSubscription);
    }

    // Cleanup subscriptions
    return () => {
      subscriptions.forEach(sub => {
        supabase.removeChannel(sub);
      });
    };
  }, [options.companyId, options.enableVehicleChecks, options.enableParcelValidation, validateParcelCounts]);

  // Clear validation results
  const clearValidation = useCallback(() => {
    setValidationResults({
      isValid: true,
      errors: [],
      warnings: []
    });
  }, []);

  return {
    validationResults,
    vehicleAvailability,
    checkVehicleAvailability,
    checkDuplicateEntries,
    validateParcelCounts,
    clearValidation
  };
}