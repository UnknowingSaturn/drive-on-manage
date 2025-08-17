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
      const permissions = await Geolocation.checkPermissions();
      if (permissions.location === 'granted' || permissions.coarseLocation === 'granted') {
        setPermissionGranted(true);
      }
    } catch (error) {
      console.error('Error checking permissions:', error);
    }
  };

  const requestPermissions = async () => {
    try {
      const permissions = await Geolocation.requestPermissions();
      if (permissions.location === 'granted' || permissions.coarseLocation === 'granted') {
        setPermissionGranted(true);
        toast.success('Location permissions granted');
        return true;
      } else {
        toast.error('Location permissions required for tracking');
        return false;
      }
    } catch (error) {
      console.error('Error requesting permissions:', error);
      toast.error('Failed to request location permissions');
      return false;
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
      const { error } = await supabase.from('location_points').insert({
        driver_id: profile.id,
        company_id: profile.company_id,
        shift_id: shift.id,
        latitude: locationPoint.latitude,
        longitude: locationPoint.longitude,
        accuracy: locationPoint.accuracy,
        speed: locationPoint.speed,
        heading: locationPoint.heading,
        battery_level: locationPoint.batteryLevel,
        timestamp: new Date(locationPoint.timestamp).toISOString(),
        is_offline_sync: false
      });

      if (error) throw error;
      
      lastUpdateTime.current = Date.now();
      lastPosition.current = locationPoint;
    } catch (error) {
      console.error('Failed to send location update:', error);
      // Add to offline queue
      offlineQueue.current.push(locationPoint);
    }
  };

  const processOfflineQueue = async () => {
    if (offlineQueue.current.length === 0 || !profile?.id || !shift.id) return;

    const queue = [...offlineQueue.current];
    offlineQueue.current = [];

    for (const locationPoint of queue) {
      try {
        const { error } = await supabase.from('location_points').insert({
          driver_id: profile.id,
          company_id: profile.company_id,
          shift_id: shift.id,
          latitude: locationPoint.latitude,
          longitude: locationPoint.longitude,
          accuracy: locationPoint.accuracy,
          speed: locationPoint.speed,
          heading: locationPoint.heading,
          battery_level: locationPoint.batteryLevel,
          timestamp: new Date(locationPoint.timestamp).toISOString(),
          is_offline_sync: true
        });

        if (error) {
          // Re-add to queue if still failing
          offlineQueue.current.push(locationPoint);
        }
      } catch (error) {
        console.error('Failed to process offline location:', error);
        offlineQueue.current.push(locationPoint);
      }
    }
  };

  const startShift = async (): Promise<boolean> => {
    if (!permissionGranted) {
      const granted = await requestPermissions();
      if (!granted) return false;
    }

    if (!consentGiven) {
      toast.error('Location tracking consent required');
      return false;
    }

    if (!profile?.id) {
      toast.error('Profile not loaded');
      return false;
    }

    try {
      // Create new shift
      const { data: shiftData, error: shiftError } = await supabase
        .from('driver_shifts')
        .insert({
          driver_id: profile.id,
          company_id: profile.company_id,
          status: 'active',
          consent_given: true
        })
        .select()
        .single();

      if (shiftError) throw shiftError;

      setShift({
        id: shiftData.id,
        status: 'active',
        startTime: new Date(shiftData.start_time)
      });

      // Start location tracking
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
        await Geolocation.clearWatch({ id: watchId.current });
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
        await Geolocation.clearWatch({ id: watchId.current });
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
    offlineQueueLength: offlineQueue.current.length
  };
}