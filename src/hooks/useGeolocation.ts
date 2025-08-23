import { useState, useEffect, useRef } from 'react';
import { Geolocation, Position } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface LocationPoint {
  latitude: number;
  longitude: number;
  accuracy: number;
  speed?: number;
  heading?: number;
  timestamp: number;
  batteryLevel?: number;
}

interface ShiftState {
  id: string | null;
  status: 'inactive' | 'active' | 'paused';
  startTime: Date | null;
}

export function useGeolocation() {
  const { profile } = useAuth();
  const [isTracking, setIsTracking] = useState(false);
  const [shift, setShift] = useState<ShiftState>({
    id: null,
    status: 'inactive',
    startTime: null
  });
  const [currentLocation, setCurrentLocation] = useState<LocationPoint | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);
  
  const watchId = useRef<string | null>(null);
  const offlineQueue = useRef<LocationPoint[]>([]);
  const lastUpdateTime = useRef<number>(0);
  const lastPosition = useRef<LocationPoint | null>(null);

  // Check permissions on mount
  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        const permissions = await Geolocation.checkPermissions();
        const granted = permissions.location === 'granted' || permissions.coarseLocation === 'granted';
        setPermissionGranted(granted);
        console.log('Native permission check:', granted);
      } else {
        // Web environment - properly check geolocation permission status
        if (!navigator.geolocation) {
          setPermissionGranted(false);
          console.log('Geolocation not supported');
          return;
        }

        if (navigator.permissions) {
          try {
            const permission = await navigator.permissions.query({name: 'geolocation'});
            const granted = permission.state === 'granted';
            setPermissionGranted(granted);
            console.log('Web permission check via query:', granted, permission.state);
          } catch (error) {
            console.warn('Permission query failed, will test with getCurrentPosition:', error);
            // Fallback: test actual geolocation access
            await testGeolocationAccess();
          }
        } else {
          // Older browsers - test actual access
          await testGeolocationAccess();
        }
      }
    } catch (error) {
      console.error('Error checking permissions:', error);
      setPermissionGranted(false);
    }
  };

  // Test geolocation access for browsers that don't support permission query
  const testGeolocationAccess = async () => {
    return new Promise<void>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => {
          setPermissionGranted(true);
          console.log('Geolocation test: access granted');
          resolve();
        },
        (error) => {
          const granted = error.code !== 1; // Not PERMISSION_DENIED
          setPermissionGranted(granted);
          console.log('Geolocation test:', granted ? 'position unavailable but permission OK' : 'permission denied');
          resolve();
        },
        { timeout: 5000, maximumAge: Infinity }
      );
    });
  };

  const requestPermissions = async (): Promise<boolean> => {
    try {
      if (Capacitor.isNativePlatform()) {
        const permissions = await Geolocation.requestPermissions();
        const granted = permissions.location === 'granted' || permissions.coarseLocation === 'granted';
        setPermissionGranted(granted);
        
        if (granted) {
          toast.success('Location permissions granted');
          return true;
        } else {
          toast.error('Location permissions required for tracking');
          return false;
        }
      } else {
        // Web environment - comprehensive permission request strategy
        if (!navigator.geolocation) {
          toast.error('Geolocation not supported by this browser');
          return false;
        }

        console.log('Requesting web geolocation permissions...');
        
        // Try to get position with multiple fallback strategies
        const strategies = [
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 180000 },
          { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 }
        ];

        for (const [index, options] of strategies.entries()) {
          console.log(`Trying permission strategy ${index + 1}:`, options);
          
          const success = await new Promise<boolean>((resolve) => {
            navigator.geolocation.getCurrentPosition(
              (position) => {
                console.log(`Strategy ${index + 1} succeeded:`, position.coords);
                setPermissionGranted(true);
                resolve(true);
              },
              (error) => {
                console.warn(`Strategy ${index + 1} failed:`, error.code, error.message);
                
                // Permission denied is a hard failure
                if (error.code === 1) { // PERMISSION_DENIED
                  toast.error('Location access denied. Please enable location permissions in your browser.');
                  resolve(false);
                } else {
                  // Position unavailable or timeout - try next strategy
                  resolve(false);
                }
              },
              options
            );
          });

          if (success) {
            toast.success('Location permissions granted');
            return true;
          }
          
          // If permission was explicitly denied, don't try other strategies
          if (!success && index === 0) {
            // Check if this was a permission denial vs other error
            const permissionDenied = await new Promise<boolean>((resolve) => {
              navigator.geolocation.getCurrentPosition(
                () => resolve(false),
                (error) => resolve(error.code === 1),
                { timeout: 1000 }
              );
            });
            
            if (permissionDenied) {
              return false;
            }
          }
        }

        // Final fallback - try IP geolocation
        console.log('All GPS strategies failed, trying IP geolocation fallback...');
        try {
          await tryIPGeolocation();
          setPermissionGranted(true);
          toast.success('Location determined using network (limited accuracy)');
          return true;
        } catch (error) {
          console.error('IP geolocation failed:', error);
          toast.error('Unable to determine location. Please enable GPS or location services.');
          return false;
        }
      }
    } catch (error) {
      console.error('Error requesting permissions:', error);
      toast.error('Failed to request location permissions');
      return false;
    }
  };

  // IP Geolocation fallback for devices without GPS
  const tryIPGeolocation = async (): Promise<LocationPoint | null> => {
    try {
      console.log('Attempting IP geolocation fallback...');
      
      // Use a free IP geolocation service (ipapi.co)
      const response = await fetch('https://ipapi.co/json/');
      if (!response.ok) throw new Error('IP geolocation service unavailable');
      
      const data = await response.json();
      
      if (data.latitude && data.longitude) {
        const locationPoint: LocationPoint = {
          latitude: parseFloat(data.latitude),
          longitude: parseFloat(data.longitude),
          accuracy: 10000, // IP location is very inaccurate (10km)
          speed: undefined,
          heading: undefined,
          timestamp: Date.now(),
          batteryLevel: undefined
        };
        
        setCurrentLocation(locationPoint);
        console.log('IP geolocation successful:', locationPoint);
        toast.success('Location determined using network. Accuracy may be limited.');
        
        return locationPoint;
      } else {
        throw new Error('Invalid IP geolocation response');
      }
    } catch (error) {
      console.error('IP geolocation failed:', error);
      throw error;
    }
  };

  // Enhanced location capture with multiple fallback strategies
  const captureLocationWithFallbacks = async (): Promise<LocationPoint | null> => {
    if (!navigator.geolocation) {
      console.warn('Geolocation not supported, trying IP fallback');
      return await tryIPGeolocation();
    }

    const attemptLocationCapture = (options: PositionOptions): Promise<LocationPoint | null> => {
      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const batteryLevel = await getBatteryLevel();
            
            const locationPoint: LocationPoint = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy || 0,
              speed: position.coords.speed || undefined,
              heading: position.coords.heading || undefined,
              timestamp: position.timestamp,
              batteryLevel
            };
            
            console.log('GPS location captured:', locationPoint);
            resolve(locationPoint);
          },
          (error) => {
            console.warn('GPS capture failed:', error);
            resolve(null);
          },
          options
        );
      });
    };

    // Progressive fallback strategy
    const strategies = [
      // High accuracy GPS
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
      // Medium accuracy 
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 180000 },
      // Network-based location
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 },
      // Very permissive final attempt
      { enableHighAccuracy: false, timeout: 20000, maximumAge: 600000 }
    ];

    for (const [index, strategy] of strategies.entries()) {
      console.log(`Trying location strategy ${index + 1}:`, strategy);
      
      try {
        const result = await attemptLocationCapture(strategy);
        if (result) {
          setCurrentLocation(result);
          return result;
        }
      } catch (error) {
        console.warn(`Strategy ${index + 1} failed:`, error);
      }
    }

    // Final fallback to IP geolocation
    console.log('All GPS strategies failed, falling back to IP geolocation');
    try {
      return await tryIPGeolocation();
    } catch (error) {
      console.error('All location strategies failed:', error);
      return null;
    }
  };

  const shouldSendUpdate = (newPosition: LocationPoint): boolean => {
    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdateTime.current;
    
    // Send if it's been more than 90 seconds
    if (timeSinceLastUpdate > 90000) return true;
    
    // Send if moved more than 200 meters
    if (lastPosition.current) {
      const distance = calculateDistance(
        lastPosition.current.latitude,
        lastPosition.current.longitude,
        newPosition.latitude,
        newPosition.longitude
      );
      if (distance > 200) return true;
    }
    
    return false;
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const getBatteryLevel = async (): Promise<number | undefined> => {
    if (!Capacitor.isNativePlatform()) return undefined;
    
    try {
      // On native platforms, try to get battery info
      // This is a simplified version - you'd need a proper battery plugin
      return undefined;
    } catch {
      return undefined;
    }
  };

  const sendLocationUpdate = async (locationPoint: LocationPoint) => {
    if (!profile?.id || !shift.id) return;

    try {
      // Use edge function for secure location ingestion
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error('No authentication session');
        offlineQueue.current.push(locationPoint);
        return;
      }

      const { data, error } = await supabase.functions.invoke('location-ingest', {
        body: {
          driver_id: profile.id,
          latitude: locationPoint.latitude,
          longitude: locationPoint.longitude,
          accuracy: locationPoint.accuracy,
          speed: locationPoint.speed,
          heading: locationPoint.heading,
          battery_level: locationPoint.batteryLevel,
          activity_type: 'automotive',
          shift_id: shift.id,
          is_offline_sync: false
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error('Failed to send location via edge function:', error);
        offlineQueue.current.push(locationPoint);
      } else {
        console.log('Location sent successfully:', data);
        lastUpdateTime.current = Date.now();
        lastPosition.current = locationPoint;
      }
    } catch (error) {
      console.error('Failed to send location update:', error);
      offlineQueue.current.push(locationPoint);
    }
  };

  const processOfflineQueue = async () => {
    if (offlineQueue.current.length === 0 || !profile?.id || !shift.id) return;

    const queue = [...offlineQueue.current];
    offlineQueue.current = [];

    try {
      // Use edge function for batch processing
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error('No authentication session for offline sync');
        offlineQueue.current.push(...queue);
        return;
      }

      const locationBatch = queue.map(locationPoint => ({
        driver_id: profile.id,
        latitude: locationPoint.latitude,
        longitude: locationPoint.longitude,
        accuracy: locationPoint.accuracy,
        speed: locationPoint.speed,
        heading: locationPoint.heading,
        battery_level: locationPoint.batteryLevel,
        activity_type: 'automotive',
        shift_id: shift.id,
        is_offline_sync: true
      }));

      const { data, error } = await supabase.functions.invoke('location-ingest', {
        body: locationBatch,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error('Failed to process offline queue:', error);
        offlineQueue.current.push(...queue);
      } else {
        console.log(`Successfully synced ${queue.length} offline locations:`, data);
      }
    } catch (error) {
      console.error('Failed to process offline locations:', error);
      offlineQueue.current.push(...queue);
    }
  };

  const startShift = async (
    bypassConsentCheck = false, 
    locationData?: { latitude?: number; longitude?: number; accuracy?: number }
  ): Promise<boolean> => {
    console.log('startShift called with:', { 
      permissionGranted, 
      consentGiven, 
      bypassConsentCheck,
      hasProfile: !!profile?.id,
      locationData 
    });

    if (!permissionGranted) {
      const granted = await requestPermissions();
      if (!granted) return false;
    }

    if (!consentGiven && !bypassConsentCheck) {
      console.error('Location consent not given and not bypassed');
      toast.error('Location tracking consent required');
      return false;
    }

    if (!profile?.id) {
      toast.error('Profile not loaded');
      return false;
    }

    try {
      // Create new shift with location data
      const shiftInsertData: any = {
        driver_id: profile.id,
        company_id: profile.company_id,
        status: 'active',
        consent_given: true,
        location_consent: true // Explicitly set location consent
      };

      // Add location data if provided
      if (locationData) {
        if (locationData.latitude) shiftInsertData.start_lat = locationData.latitude;
        if (locationData.longitude) shiftInsertData.start_lng = locationData.longitude;
        if (locationData.accuracy) shiftInsertData.start_accuracy_m = locationData.accuracy;
      }

      console.log('Inserting shift with data:', shiftInsertData);

      const { data: shiftData, error: shiftError } = await supabase
        .from('driver_shifts')
        .insert(shiftInsertData)
        .select()
        .single();

      if (shiftError) throw shiftError;

      setShift({
        id: shiftData.id,
        status: 'active',
        startTime: new Date(shiftData.start_time)
      });

      // Start location tracking with enhanced error handling
      if (Capacitor.isNativePlatform()) {
        const watchHandler = async (position: Position | null) => {
          if (!position) return;

          const batteryLevel = await getBatteryLevel();
          
          const locationPoint: LocationPoint = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy || 0,
            speed: position.coords.speed || undefined,
            heading: position.coords.heading || undefined,
            timestamp: position.timestamp,
            batteryLevel
          };

          setCurrentLocation(locationPoint);

          if (shouldSendUpdate(locationPoint)) {
            await sendLocationUpdate(locationPoint);
          }
        };

        const errorHandler = (error: any) => {
          console.error('Native geolocation watch error:', error);
          toast.error('Location tracking interrupted. Attempting to restart...');
          
          // Attempt to restart tracking after brief delay
          setTimeout(async () => {
            try {
              if (watchId.current) {
                await Geolocation.clearWatch({ id: watchId.current });
              }
              
              // Restart with more permissive settings
              watchId.current = await Geolocation.watchPosition(
                {
                  enableHighAccuracy: false,
                  timeout: 45000,
                  maximumAge: 60000
                },
                watchHandler
              );
              
              console.log('Location tracking restarted with fallback settings');
            } catch (restartError) {
              console.error('Failed to restart location tracking:', restartError);
            }
          }, 3000);
        };

        // Try high accuracy first, fallback on error
        try {
          watchId.current = await Geolocation.watchPosition(
            {
              enableHighAccuracy: true,
              timeout: 30000,
              maximumAge: 30000
            },
            watchHandler
          );
        } catch (highAccuracyError) {
          console.warn('High accuracy watch failed, trying standard accuracy:', highAccuracyError);
          
          watchId.current = await Geolocation.watchPosition(
            {
              enableHighAccuracy: false,
              timeout: 45000,
              maximumAge: 60000
            },
            watchHandler
          );
        }
      } else {
        // Web environment with robust fallback handling
        const startWebTracking = async (options: PositionOptions) => {
          const watchHandler = async (position: GeolocationPosition) => {
            const batteryLevel = await getBatteryLevel();
            
            const locationPoint: LocationPoint = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy || 0,
              speed: position.coords.speed || undefined,
              heading: position.coords.heading || undefined,
              timestamp: position.timestamp,
              batteryLevel
            };

            setCurrentLocation(locationPoint);

            if (shouldSendUpdate(locationPoint)) {
              await sendLocationUpdate(locationPoint);
            }
          };

          const errorHandler = async (error: GeolocationPositionError) => {
            console.error('Web geolocation watch error:', error);
            
            let shouldRestart = false;
            let newOptions = options;
            
            if (error.code === error.POSITION_UNAVAILABLE) {
              console.log('Position unavailable, trying lower accuracy...');
              newOptions = {
                enableHighAccuracy: false,
                timeout: 30000,
                maximumAge: 120000
              };
              shouldRestart = true;
            } else if (error.code === error.TIMEOUT) {
              console.log('Location timeout, increasing timeout period...');
              newOptions = {
                ...options,
                timeout: Math.min(options.timeout! * 2, 60000)
              };
              shouldRestart = true;
            }
            
            if (shouldRestart && watchId.current) {
              navigator.geolocation.clearWatch(parseInt(watchId.current));
              
              setTimeout(() => {
                const newWatchId = navigator.geolocation.watchPosition(
                  watchHandler,
                  errorHandler,
                  newOptions
                );
                watchId.current = newWatchId.toString();
                console.log('Web location tracking restarted with new options:', newOptions);
              }, 2000);
            }
          };

          const webWatchId = navigator.geolocation.watchPosition(
            watchHandler,
            errorHandler,
            options
          );
          
          watchId.current = webWatchId.toString();
          console.log('Web location tracking started with options:', options);
        };

        // Get initial location to ensure tracking works
        try {
          const initialLocation = await captureLocationWithFallbacks();
          if (initialLocation) {
            // Start tracking with appropriate settings based on initial success
            const isHighAccuracy = initialLocation.accuracy < 100;
            
            await startWebTracking({
              enableHighAccuracy: isHighAccuracy,
              timeout: isHighAccuracy ? 30000 : 45000,
              maximumAge: isHighAccuracy ? 30000 : 60000
            });
          } else {
            throw new Error('Unable to obtain initial location');
          }
        } catch (error) {
          console.error('Failed to start web tracking:', error);
          toast.error('Location tracking failed to start. Using fallback mode.');
          
          // Start with very permissive settings as last resort
          await startWebTracking({
            enableHighAccuracy: false,
            timeout: 60000,
            maximumAge: 300000
          });
        }
      }

      setIsTracking(true);
      toast.success('Shift started - Location tracking enabled');
      
      // Process any queued offline locations
      processOfflineQueue();
      
      return true;
    } catch (error) {
      console.error('Failed to start shift:', error);
      toast.error('Failed to start shift');
      return false;
    }
  };

  const pauseShift = async () => {
    if (!shift.id) return;

    try {
      const { error } = await supabase
        .from('driver_shifts')
        .update({ status: 'paused' })
        .eq('id', shift.id);

      if (error) throw error;

      setShift(prev => ({ ...prev, status: 'paused' }));
      
      if (watchId.current) {
        if (Capacitor.isNativePlatform()) {
          await Geolocation.clearWatch({ id: watchId.current });
        } else {
          navigator.geolocation.clearWatch(parseInt(watchId.current));
        }
        watchId.current = null;
      }
      
      setIsTracking(false);
      toast.success('Shift paused - Location tracking stopped');
    } catch (error) {
      console.error('Failed to pause shift:', error);
      toast.error('Failed to pause shift');
    }
  };

  const resumeShift = async () => {
    if (!shift.id || shift.status !== 'paused') return;
    
    try {
      const { error } = await supabase
        .from('driver_shifts')
        .update({ status: 'active' })
        .eq('id', shift.id);

      if (error) throw error;

      setShift(prev => ({ ...prev, status: 'active' }));
      
      // Restart location tracking
      if (Capacitor.isNativePlatform()) {
        watchId.current = await Geolocation.watchPosition(
          {
            enableHighAccuracy: true,
            timeout: 30000,
            maximumAge: 30000
          },
          async (position: Position | null) => {
            if (!position) return;

            const batteryLevel = await getBatteryLevel();
            
            const locationPoint: LocationPoint = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy || 0,
              speed: position.coords.speed || undefined,
              heading: position.coords.heading || undefined,
              timestamp: position.timestamp,
              batteryLevel
            };

            setCurrentLocation(locationPoint);

            if (shouldSendUpdate(locationPoint)) {
              await sendLocationUpdate(locationPoint);
            }
          }
        );
      } else {
        // Web environment - use navigator.geolocation
        const watchHandler = async (position: GeolocationPosition) => {
          const batteryLevel = await getBatteryLevel();
          
          const locationPoint: LocationPoint = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy || 0,
            speed: position.coords.speed || undefined,
            heading: position.coords.heading || undefined,
            timestamp: position.timestamp,
            batteryLevel
          };

          setCurrentLocation(locationPoint);

          if (shouldSendUpdate(locationPoint)) {
            await sendLocationUpdate(locationPoint);
          }
        };

        const webWatchId = navigator.geolocation.watchPosition(
          watchHandler,
          (error) => {
            console.error('Geolocation watch error:', error);
            toast.error('Location tracking error: ' + error.message);
          },
          {
            enableHighAccuracy: true,
            timeout: 30000,
            maximumAge: 30000
          }
        );
        
        watchId.current = webWatchId.toString();
      }

      setIsTracking(true);
      toast.success('Shift resumed - Location tracking enabled');
    } catch (error) {
      console.error('Failed to resume shift:', error);
      toast.error('Failed to resume shift');
    }
  };

  const endShift = async () => {
    if (!shift.id) return;

    try {
      // Stop location tracking
      if (watchId.current) {
        if (Capacitor.isNativePlatform()) {
          await Geolocation.clearWatch({ id: watchId.current });
        } else {
          navigator.geolocation.clearWatch(parseInt(watchId.current));
        }
        watchId.current = null;
      }

      // Process any remaining offline queue
      await processOfflineQueue();

      // Update shift status
      const { error } = await supabase
        .from('driver_shifts')
        .update({ 
          status: 'ended',
          end_time: new Date().toISOString()
        })
        .eq('id', shift.id);

      if (error) throw error;

      setShift({
        id: null,
        status: 'inactive',
        startTime: null
      });
      
      setIsTracking(false);
      setCurrentLocation(null);
      toast.success('Shift ended - Location tracking stopped');
    } catch (error) {
      console.error('Failed to end shift:', error);
      toast.error('Failed to end shift');
    }
  };

  return {
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
    offlineQueueLength: offlineQueue.current.length,
    captureLocationWithFallbacks
  };
}