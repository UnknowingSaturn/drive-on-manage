import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  MapPin, 
  Play, 
  Pause, 
  Square, 
  Shield, 
  Clock, 
  Battery,
  Wifi,
  WifiOff,
  AlertTriangle
} from 'lucide-react';
import { useGeolocation } from '@/hooks/useGeolocation';
import { format } from 'date-fns';

export function LocationTrackingWidget() {
  const {
    isTracking,
    shift,
    currentLocation,
    permissionGranted,
    consentGiven,
    setConsentGiven,
    startShift,
    pauseShift,
    resumeShift,
    endShift,
    requestPermissions,
    offlineQueueLength
  } = useGeolocation();

  const [showConsentDialog, setShowConsentDialog] = useState(false);

  const [isStarting, setIsStarting] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const handleStartShift = async () => {
    if (!consentGiven) {
      setShowConsentDialog(true);
      return;
    }
    
    setIsStarting(true);
    setLastError(null);
    
    try {
      const result = await startShift();
      if (!result) {
        setLastError('Failed to start shift. Please check location permissions.');
      }
    } catch (error) {
      setLastError(error instanceof Error ? error.message : 'Failed to start shift');
    } finally {
      setIsStarting(false);
    }
  };

  const handleConsentAccept = async () => {
    setConsentGiven(true);
    setShowConsentDialog(false);
    
    setIsStarting(true);
    setLastError(null);
    
    try {
      const result = await startShift();
      if (!result) {
        setLastError('Failed to start shift. Please check location permissions.');
      }
    } catch (error) {
      setLastError(error instanceof Error ? error.message : 'Failed to start shift');
    } finally {
      setIsStarting(false);
    }
  };

  const getStatusColor = () => {
    switch (shift.status) {
      case 'active': return 'bg-green-500';
      case 'paused': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = () => {
    switch (shift.status) {
      case 'active': return 'On Shift';
      case 'paused': return 'Paused';
      default: return 'Off Shift';
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Location Tracking
          {isTracking && (
            <Badge variant="secondary" className="ml-auto">
              <div className={`w-2 h-2 rounded-full ${getStatusColor()} mr-1 animate-pulse`} />
              {getStatusText()}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Error Alert */}
        {lastError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{lastError}</AlertDescription>
          </Alert>
        )}

        {/* Permission Status */}
        {!permissionGranted && (
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              Location permissions required for tracking. 
              <Button 
                variant="link" 
                className="p-0 h-auto ml-1"
                onClick={requestPermissions}
              >
                Grant permissions
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Persistent Status Banner */}
        {isTracking && (
          <Alert className="border-green-200 bg-green-50 dark:bg-green-950">
            <MapPin className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800 dark:text-green-200">
              <div className="flex items-center justify-between">
                <span className="font-medium">Location Sharing: ON</span>
                <div className="flex items-center gap-2">
                  {offlineQueueLength > 0 ? (
                    <WifiOff className="h-4 w-4 text-orange-500" />
                  ) : (
                    <Wifi className="h-4 w-4 text-green-500" />
                  )}
                  {currentLocation?.batteryLevel && (
                    <div className="flex items-center gap-1">
                      <Battery className="h-3 w-3" />
                      <span className="text-xs">{currentLocation.batteryLevel}%</span>
                    </div>
                  )}
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Current Location Info */}
        {currentLocation && (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Latitude</p>
              <p className="font-mono">{currentLocation.latitude.toFixed(6)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Longitude</p>
              <p className="font-mono">{currentLocation.longitude.toFixed(6)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Accuracy</p>
              <p>{currentLocation.accuracy.toFixed(0)}m</p>
            </div>
            <div>
              <p className="text-muted-foreground">Speed</p>
              <p>{currentLocation.speed ? `${(currentLocation.speed * 3.6).toFixed(1)} km/h` : 'N/A'}</p>
            </div>
          </div>
        )}

        {/* Shift Info */}
        {shift.startTime && (
          <div className="text-sm space-y-1">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span className="text-muted-foreground">Shift Started:</span>
              <span>{format(shift.startTime, 'HH:mm')}</span>
            </div>
            {offlineQueueLength > 0 && (
              <div className="text-orange-600 dark:text-orange-400">
                {offlineQueueLength} location updates queued for sync
              </div>
            )}
          </div>
        )}

        {/* Control Buttons */}
        <div className="flex gap-2">
          {shift.status === 'inactive' && (
            <Button 
              onClick={handleStartShift}
              disabled={!permissionGranted || isStarting}
              className="flex-1"
            >
              <Play className="h-4 w-4 mr-2" />
              {isStarting ? 'Starting...' : 'Start Shift'}
            </Button>
          )}

          {shift.status === 'active' && (
            <>
              <Button onClick={pauseShift} variant="outline" className="flex-1">
                <Pause className="h-4 w-4 mr-2" />
                Pause
              </Button>
              <Button onClick={endShift} variant="destructive" className="flex-1">
                <Square className="h-4 w-4 mr-2" />
                End Shift
              </Button>
            </>
          )}

          {shift.status === 'paused' && (
            <>
              <Button onClick={resumeShift} className="flex-1">
                <Play className="h-4 w-4 mr-2" />
                Resume
              </Button>
              <Button onClick={endShift} variant="destructive" className="flex-1">
                <Square className="h-4 w-4 mr-2" />
                End Shift
              </Button>
            </>
          )}
        </div>

        {/* Consent Dialog */}
        <Dialog open={showConsentDialog} onOpenChange={setShowConsentDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Location Tracking Consent
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  <strong>Purpose:</strong> We track your location during shifts for:
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Safety monitoring and emergency support</li>
                  <li>Route optimization and assistance</li>
                  <li>Accurate payroll and delivery verification</li>
                </ul>
                
                <p className="mt-3">
                  <strong>Data Retention:</strong> Raw location data is kept for 30 days, 
                  then aggregated for statistical purposes.
                </p>
                
                <p>
                  <strong>Your Rights:</strong> You can view, delete, or opt-out of tracking 
                  at any time through your profile settings.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="consent" 
                  checked={consentGiven}
                  onCheckedChange={(checked) => setConsentGiven(checked as boolean)}
                />
                <label 
                  htmlFor="consent" 
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  I consent to location tracking during my shifts
                </label>
              </div>

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setShowConsentDialog(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleConsentAccept}
                  disabled={!consentGiven}
                  className="flex-1"
                >
                  Accept & Start Tracking
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}