import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface LocationData {
  driver_id: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  battery_level?: number;
  activity_type?: string;
  timestamp: string;
  is_offline_sync?: boolean;
  shift_id?: string;
}

interface LocationTrackingConfig {
  updateInterval: number; // milliseconds
  distanceThreshold: number; // meters
  enableOfflineQueue: boolean;
  maxOfflineLocations: number;
}

interface LocationTrackingState {
  isTracking: boolean;
  isPaused: boolean;
  lastLocation: GeolocationPosition | null;
  queuedLocations: LocationData[];
  error: string | null;
}

const DEFAULT_CONFIG: LocationTrackingConfig = {
  updateInterval: 90000, // 90 seconds
  distanceThreshold: 200, // 200 meters
  enableOfflineQueue: true,
  maxOfflineLocations: 100,
};

export const useLocationTracking = (config: Partial<LocationTrackingConfig> = {}) => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const trackingConfig = { ...DEFAULT_CONFIG, ...config };
  
  const [state, setState] = useState<LocationTrackingState>({
    isTracking: false,
    isPaused: false,
    lastLocation: null,
    queuedLocations: [],
    error: null,
  });

  const watchId = useRef<number | null>(null);
  const intervalId = useRef<NodeJS.Timeout | null>(null);
  const retryTimeoutId = useRef<NodeJS.Timeout | null>(null);
  const shiftId = useRef<string | null>(null);

  // Calculate distance between two coordinates using Haversine formula
  const calculateDistance = useCallback((lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }, []);

  // Get battery level (if supported)
  const getBatteryLevel = useCallback(async (): Promise<number | undefined> => {
    try {
      if ('getBattery' in navigator) {
        const battery = await (navigator as any).getBattery();
        return Math.round(battery.level * 100);
      }
    } catch (error) {
      console.warn('Battery API not supported:', error);
    }
    return undefined;
  }, []);

  // Send location to server
  const sendLocation = useCallback(async (locationData: LocationData): Promise<boolean> => {
    if (!profile?.user_companies?.[0]?.company_id) {
      console.error('No company ID available');
      return false;
    }

    try {
      const { data, error } = await supabase.functions.invoke('location-ingest', {
        body: locationData
      });

      if (error) {
        console.error('Failed to send location:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Location send error:', error);
      return false;
    }
  }, [profile]);

  // Send queued locations in batch
  const sendQueuedLocations = useCallback(async (): Promise<void> => {
    if (state.queuedLocations.length === 0) return;

    try {
      const { data, error } = await supabase.functions.invoke('location-ingest', {
        body: { locations: state.queuedLocations }
      });

      if (error) {
        console.error('Failed to send queued locations:', error);
        return;
      }

      // Clear queue on successful send
      setState(prev => ({ ...prev, queuedLocations: [] }));
      console.log(`Successfully sent ${state.queuedLocations.length} queued locations`);
    } catch (error) {
      console.error('Batch location send error:', error);
    }
  }, [state.queuedLocations]);

  // Process new location
  const processLocation = useCallback(async (position: GeolocationPosition) => {
    if (!profile?.id || state.isPaused) return;

    const { latitude, longitude, accuracy, speed, heading } = position.coords;
    const timestamp = new Date().toISOString();

    // Check if we should send this location based on distance threshold
    let shouldSend = true;
    if (state.lastLocation && trackingConfig.distanceThreshold > 0) {
      const distance = calculateDistance(
        state.lastLocation.coords.latitude,
        state.lastLocation.coords.longitude,
        latitude,
        longitude
      );
      shouldSend = distance >= trackingConfig.distanceThreshold;
    }

    if (!shouldSend) return;

    const batteryLevel = await getBatteryLevel();

    const locationData: LocationData = {
      driver_id: profile.id,
      latitude,
      longitude,
      accuracy: accuracy || undefined,
      speed: speed && speed >= 0 ? speed : undefined,
      heading: heading && heading >= 0 ? heading : undefined,
      battery_level: batteryLevel,
      timestamp,
      shift_id: shiftId.current || undefined,
    };

    // Try to send immediately
    const sent = await sendLocation(locationData);

    if (!sent && trackingConfig.enableOfflineQueue) {
      // Queue for later if send failed
      setState(prev => ({
        ...prev,
        queuedLocations: [
          ...prev.queuedLocations.slice(-(trackingConfig.maxOfflineLocations - 1)),
          { ...locationData, is_offline_sync: true }
        ]
      }));
    }

    setState(prev => ({ ...prev, lastLocation: position, error: null }));
  }, [
    profile,
    state.isPaused,
    state.lastLocation,
    calculateDistance,
    getBatteryLevel,
    sendLocation,
    trackingConfig.distanceThreshold,
    trackingConfig.enableOfflineQueue,
    trackingConfig.maxOfflineLocations
  ]);

  // Start tracking
  const startTracking = useCallback((currentShiftId?: string) => {
    if (!profile?.id) {
      setState(prev => ({ ...prev, error: 'No driver profile available' }));
      return;
    }

    if (!navigator.geolocation) {
      setState(prev => ({ ...prev, error: 'Geolocation not supported' }));
      return;
    }

    shiftId.current = currentShiftId || null;

    const options: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 30000,
      maximumAge: 60000,
    };

    // Start continuous watching
    watchId.current = navigator.geolocation.watchPosition(
      processLocation,
      (error) => {
        console.error('Geolocation error:', error);
        setState(prev => ({ 
          ...prev, 
          error: `Location error: ${error.message}` 
        }));
      },
      options
    );

    // Set up interval for regular updates (fallback)
    intervalId.current = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        processLocation,
        (error) => console.warn('Interval location update failed:', error),
        options
      );
    }, trackingConfig.updateInterval);

    // Set up retry mechanism for queued locations
    const retryQueue = () => {
      if (state.queuedLocations.length > 0) {
        sendQueuedLocations();
      }
      retryTimeoutId.current = setTimeout(retryQueue, 30000); // Retry every 30 seconds
    };
    retryQueue();

    setState(prev => ({ 
      ...prev, 
      isTracking: true, 
      isPaused: false, 
      error: null 
    }));

    toast({
      title: "Location Tracking Started",
      description: "GPS tracking is now active for your shift.",
    });
  }, [profile, processLocation, trackingConfig.updateInterval, sendQueuedLocations, state.queuedLocations, toast]);

  // Stop tracking
  const stopTracking = useCallback(async () => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }

    if (intervalId.current) {
      clearInterval(intervalId.current);
      intervalId.current = null;
    }

    if (retryTimeoutId.current) {
      clearTimeout(retryTimeoutId.current);
      retryTimeoutId.current = null;
    }

    // Send any remaining queued locations
    if (state.queuedLocations.length > 0) {
      await sendQueuedLocations();
    }

    setState(prev => ({ 
      ...prev, 
      isTracking: false, 
      isPaused: false,
      lastLocation: null,
      error: null
    }));

    shiftId.current = null;

    toast({
      title: "Location Tracking Stopped",
      description: "GPS tracking has been disabled.",
    });
  }, [state.queuedLocations, sendQueuedLocations, toast]);

  // Pause tracking
  const pauseTracking = useCallback(() => {
    setState(prev => ({ ...prev, isPaused: true }));
    toast({
      title: "Location Tracking Paused",
      description: "GPS tracking is temporarily paused.",
    });
  }, [toast]);

  // Resume tracking
  const resumeTracking = useCallback(() => {
    setState(prev => ({ ...prev, isPaused: false }));
    toast({
      title: "Location Tracking Resumed",
      description: "GPS tracking has been resumed.",
    });
  }, [toast]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
      }
      if (intervalId.current) {
        clearInterval(intervalId.current);
      }
      if (retryTimeoutId.current) {
        clearTimeout(retryTimeoutId.current);
      }
    };
  }, []);

  return {
    ...state,
    startTracking,
    stopTracking,
    pauseTracking,
    resumeTracking,
    sendQueuedLocations,
  };
};