import React from 'react';
import { useRealtimeValidation } from '@/hooks/useRealtimeValidation';
import { PageLayout, DashboardLayout } from '@/components/PageLayout';
import { MobileCard } from '@/components/MobileLayout';
import { ErrorMessage, ErrorType, formatError } from '@/components/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Truck, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  User,
  Package,
  MapPin,
  Calendar
} from 'lucide-react';

interface RealtimeValidationDemoProps {
  companyId: string;
  driverId?: string;
}

export function RealtimeValidationDemo({ companyId, driverId }: RealtimeValidationDemoProps) {
  const { toast } = useToast();
  
  const {
    validationResults,
    vehicleAvailability,
    checkVehicleAvailability,
    checkDuplicateEntries,
    validateParcelCounts,
    clearValidation
  } = useRealtimeValidation({
    companyId,
    driverId,
    enableVehicleChecks: true,
    enableDuplicateChecks: true,
    enableParcelValidation: true
  });

  const handleVehicleCheck = async (vehicleId: string) => {
    try {
      const result = await checkVehicleAvailability(vehicleId);
      
      if (result.isAvailable) {
        toast({
          title: "Vehicle Available",
          description: `Vehicle ${vehicleId} is ready for assignment`,
          variant: "default"
        });
      }
    } catch (error) {
      const formattedError = formatError(error, ErrorType.VALIDATION, 'vehicle-check');
      toast({
        title: "Validation Error",
        description: formattedError.message,
        variant: "destructive"
      });
    }
  };

  const handleDuplicateCheck = async (entryType: 'sod' | 'eod') => {
    if (!driverId) return;
    
    try {
      const result = await checkDuplicateEntries(driverId, entryType);
      
      if (!result.hasDuplicate) {
        toast({
          title: "Entry Available",
          description: `Driver can create new ${entryType.toUpperCase()} entry`,
          variant: "default"
        });
      }
    } catch (error) {
      const formattedError = formatError(error, ErrorType.VALIDATION, 'duplicate-check');
      toast({
        title: "Validation Error", 
        description: formattedError.message,
        variant: "destructive"
      });
    }
  };

  const handleParcelValidation = async (deliveredCount: number) => {
    if (!driverId) return;
    
    try {
      const result = await validateParcelCounts(driverId, deliveredCount);
      
      if (result.isValid) {
        toast({
          title: "Parcel Count Valid",
          description: `Delivered count ${deliveredCount} is within limits`,
          variant: "default"
        });
      }
    } catch (error) {
      const formattedError = formatError(error, ErrorType.VALIDATION, 'parcel-validation');
      toast({
        title: "Validation Error",
        description: formattedError.message, 
        variant: "destructive"
      });
    }
  };

  return (
    <DashboardLayout
      title="Real-time Validation"
      subtitle="Monitor vehicle availability, duplicate entries, and parcel counts in real-time"
    >
      {/* Validation Status */}
      <MobileCard
        header={
          <div className="flex items-center justify-between">
            <h3 className="text-responsive-lg font-semibold">Validation Status</h3>
            <Button variant="outline" size="sm" onClick={clearValidation}>
              Clear
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          {/* Overall Status */}
          <div className="flex items-center gap-2">
            {validationResults.isValid ? (
              <CheckCircle className="h-5 w-5 text-success" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-destructive" />
            )}
            <span className="font-medium">
              {validationResults.isValid ? 'All Validations Passed' : 'Validation Issues Found'}
            </span>
          </div>

          {/* Errors */}
          {validationResults.errors.length > 0 && (
            <div className="space-y-2">
              {validationResults.errors.map((error, index) => (
                <ErrorMessage 
                  key={index}
                  error={formatError(error, ErrorType.VALIDATION)}
                />
              ))}
            </div>
          )}

          {/* Warnings */}
          {validationResults.warnings.length > 0 && (
            <div className="space-y-2">
              {validationResults.warnings.map((warning, index) => (
                <div key={index} className="flex items-start gap-2 p-2 bg-warning/10 border border-warning/20 rounded">
                  <AlertTriangle className="h-4 w-4 text-warning mt-0.5" />
                  <p className="text-sm text-warning-foreground">{warning}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </MobileCard>

      {/* Vehicle Availability */}
      <MobileCard
        header={
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            <h3 className="text-responsive-lg font-semibold">Vehicle Availability</h3>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="grid gap-2">
            <Button 
              variant="outline" 
              onClick={() => handleVehicleCheck('vehicle-001')}
              className="justify-start"
            >
              <MapPin className="h-4 w-4 mr-2" />
              Check Vehicle VAN-001
            </Button>
            <Button 
              variant="outline" 
              onClick={() => handleVehicleCheck('vehicle-002')}
              className="justify-start"
            >
              <MapPin className="h-4 w-4 mr-2" />
              Check Vehicle VAN-002
            </Button>
          </div>

          {/* Vehicle Status List */}
          {vehicleAvailability.length > 0 && (
            <div className="space-y-2 mt-4">
              <h4 className="text-sm font-medium text-muted-foreground">Current Status</h4>
              {vehicleAvailability.map((vehicle) => (
                <div key={vehicle.vehicleId} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                  <div className="flex items-center gap-2">
                    <Truck className="h-4 w-4" />
                    <span className="text-sm font-medium">{vehicle.vehicleId}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant={vehicle.isAvailable ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {vehicle.isAvailable ? 'Available' : 'Assigned'}
                    </Badge>
                    {vehicle.assignedDriver && (
                      <span className="text-xs text-muted-foreground">
                        Driver: {vehicle.assignedDriver.slice(0, 8)}...
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </MobileCard>

      {/* Duplicate Entry Checks */}
      <MobileCard
        header={
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            <h3 className="text-responsive-lg font-semibold">Duplicate Entry Prevention</h3>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="grid gap-2">
            <Button 
              variant="outline" 
              onClick={() => handleDuplicateCheck('sod')}
              className="justify-start"
              disabled={!driverId}
            >
              <Calendar className="h-4 w-4 mr-2" />
              Check SOD Entry
            </Button>
            <Button 
              variant="outline" 
              onClick={() => handleDuplicateCheck('eod')}
              className="justify-start"
              disabled={!driverId}
            >
              <Calendar className="h-4 w-4 mr-2" />
              Check EOD Entry
            </Button>
          </div>
          
          {!driverId && (
            <p className="text-sm text-muted-foreground">
              Select a driver to check for duplicate entries
            </p>
          )}
        </div>
      </MobileCard>

      {/* Parcel Count Validation */}
      <MobileCard
        header={
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            <h3 className="text-responsive-lg font-semibold">Parcel Count Validation</h3>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="grid gap-2">
            <Button 
              variant="outline" 
              onClick={() => handleParcelValidation(50)}
              className="justify-start"
              disabled={!driverId}
            >
              <Package className="h-4 w-4 mr-2" />
              Validate 50 Parcels Delivered
            </Button>
            <Button 
              variant="outline" 
              onClick={() => handleParcelValidation(75)}
              className="justify-start"
              disabled={!driverId}
            >
              <Package className="h-4 w-4 mr-2" />
              Validate 75 Parcels Delivered
            </Button>
            <Button 
              variant="outline" 
              onClick={() => handleParcelValidation(150)}
              className="justify-start text-destructive"
              disabled={!driverId}
            >
              <Package className="h-4 w-4 mr-2" />
              Validate 150 Parcels (Over Limit)
            </Button>
          </div>
          
          {!driverId && (
            <p className="text-sm text-muted-foreground">
              Select a driver to validate parcel counts
            </p>
          )}
        </div>
      </MobileCard>

      {/* Real-time Status */}
      <MobileCard
        header={
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            <h3 className="text-responsive-lg font-semibold">Real-time Monitoring</h3>
          </div>
        }
      >
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>✅ Vehicle availability tracking active</p>
          <p>✅ Duplicate entry prevention enabled</p>
          <p>✅ Parcel count validation monitoring</p>
          <p>✅ Real-time database triggers active</p>
          
          <div className="mt-4 p-3 bg-primary/10 rounded border">
            <p className="text-primary font-medium">
              🔄 Live validation is running for company: {companyId}
            </p>
            {driverId && (
              <p className="text-primary text-xs mt-1">
                Driver ID: {driverId}
              </p>
            )}
          </div>
        </div>
      </MobileCard>
    </DashboardLayout>
  );
}