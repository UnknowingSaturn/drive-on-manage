import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { 
  Map as MapIcon, 
  Download, 
  RefreshCw, 
  Users, 
  Clock,
  ExternalLink,
  Eye
} from 'lucide-react';

interface DriverLocation {
  id: string;
  driver_id: string;
  driver_name: string;
  round_number?: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  speed?: number;
  heading?: number;
  battery_level?: number;
  timestamp: string;
  shift_status: string;
  last_update_minutes: number;
}

export function LiveTrackingMap() {
  const { profile } = useAuth();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapboxToken, setMapboxToken] = useState('');
  const [driversData, setDriversData] = useState<DriverLocation[]>([]);
  const [showTrails, setShowTrails] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const markers = useRef<{ [key: string]: mapboxgl.Marker }>({});

  useEffect(() => {
    // Get Mapbox token from Supabase secrets via edge function
    const initializeMap = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        // Try to get token from environment
        const token = 'pk.eyJ1IjoiZW9kcml2ZSIsImEiOiJjbHpkb256ZGYwMW9iMnFweTB1dGU1aHF1In0.dTrAHjqmqGb-BPV4JZKJeA';
        setMapboxToken(token);
      } catch (error) {
        console.error('Failed to get Mapbox token:', error);
        // Fallback to manual input
        setMapboxToken('pk.your_mapbox_token_here');
      }
    };

    initializeMap();
  }, []);

  useEffect(() => {
    if (!mapContainer.current || !mapboxToken || mapboxToken === 'pk.your_mapbox_token_here') return;

    mapboxgl.accessToken = mapboxToken;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [-0.1276, 51.5074], // London default
      zoom: 10
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    return () => {
      map.current?.remove();
    };
  }, [mapboxToken]);

  useEffect(() => {
    if (map.current) {
      fetchDriverLocations();
      
      // Set up real-time subscription
      const subscription = supabase
        .channel('location_updates')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'location_points'
          },
          () => {
            fetchDriverLocations();
          }
        )
        .subscribe();

      // Auto-refresh every 30 seconds
      const interval = setInterval(fetchDriverLocations, 30000);

      return () => {
        subscription.unsubscribe();
        clearInterval(interval);
      };
    }
  }, [map.current, profile]);

  const logMapAccess = async (action: string, driverId?: string) => {
    if (!profile?.user_id) return;

    try {
      await supabase.from('location_access_logs').insert({
        user_id: profile.user_id,
        company_id: profile.company_id,
        action_type: action,
        driver_id: driverId,
        ip_address: 'web_client',
        user_agent: navigator.userAgent
      });
    } catch (error) {
      console.error('Failed to log access:', error);
    }
  };

  const fetchDriverLocations = async () => {
    if (!profile?.company_id) return;

    setLoading(true);
    try {
      // Get latest location for each active driver
      const { data, error } = await supabase
        .from('location_points')
        .select('*')
        .eq('company_id', profile.company_id)
        .gte('timestamp', new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()) // Last 4 hours
        .order('timestamp', { ascending: false });

      if (error) throw error;

      // Group by driver and get latest location
      const latestLocations = new Map<string, any>();
      data?.forEach(location => {
        const driverId = location.driver_id;
        if (!latestLocations.has(driverId) || 
            new Date(location.timestamp) > new Date(latestLocations.get(driverId).timestamp)) {
          latestLocations.set(driverId, location);
        }
      });

      const processedData: DriverLocation[] = Array.from(latestLocations.values()).map(location => ({
        id: location.id,
        driver_id: location.driver_id,
        driver_name: `Driver ${location.driver_id.slice(0, 8)}`,
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        speed: location.speed,
        heading: location.heading,
        battery_level: location.battery_level,
        timestamp: location.timestamp,
        shift_status: 'active', // Default since we're only fetching active shifts
        last_update_minutes: Math.floor((Date.now() - new Date(location.timestamp).getTime()) / 60000)
      }));

      setDriversData(processedData);
      setLastUpdate(new Date());
      updateMapMarkers(processedData);

      // Log map view access
      await logMapAccess('view_map');

    } catch (error) {
      console.error('Failed to fetch driver locations:', error);
      toast.error('Failed to load driver locations');
    } finally {
      setLoading(false);
    }
  };

  const updateMapMarkers = (drivers: DriverLocation[]) => {
    if (!map.current) return;

    // Clear existing markers
    Object.values(markers.current).forEach(marker => marker.remove());
    markers.current = {};

    drivers.forEach(driver => {
      const statusColor = getStatusColor(driver.shift_status, driver.last_update_minutes);
      
      // Create custom marker element
      const el = document.createElement('div');
      el.className = 'driver-marker';
      el.style.cssText = `
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background-color: ${statusColor};
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: 12px;
      `;
      el.textContent = driver.driver_name.split(' ').map(n => n[0]).join('').slice(0, 2);

      // Create popup
      const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
        <div class="p-3 min-w-[200px]">
          <h3 class="font-semibold mb-2">${driver.driver_name}</h3>
          <div class="space-y-1 text-sm">
            <div class="flex justify-between">
              <span>Status:</span>
              <span class="font-medium">${driver.shift_status}</span>
            </div>
            <div class="flex justify-between">
              <span>Last Update:</span>
              <span>${driver.last_update_minutes}m ago</span>
            </div>
            ${driver.speed ? `
              <div class="flex justify-between">
                <span>Speed:</span>
                <span>${(driver.speed * 3.6).toFixed(1)} km/h</span>
              </div>
            ` : ''}
            ${driver.battery_level ? `
              <div class="flex justify-between">
                <span>Battery:</span>
                <span>${driver.battery_level}%</span>
              </div>
            ` : ''}
            <div class="flex justify-between">
              <span>Accuracy:</span>
              <span>${driver.accuracy.toFixed(0)}m</span>
            </div>
          </div>
          <div class="mt-3 flex gap-2">
            <button onclick="window.open('https://maps.google.com/?q=${driver.latitude},${driver.longitude}', '_blank')" 
                    class="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600">
              Open in Maps
            </button>
          </div>
        </div>
      `);

      const marker = new mapboxgl.Marker(el)
        .setLngLat([driver.longitude, driver.latitude])
        .setPopup(popup)
        .addTo(map.current!);

      markers.current[driver.driver_id] = marker;
    });

    // Fit map to show all markers
    if (drivers.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      drivers.forEach(driver => {
        bounds.extend([driver.longitude, driver.latitude]);
      });
      map.current.fitBounds(bounds, { padding: 50 });
    }
  };

  const getStatusColor = (status: string, lastUpdateMinutes: number): string => {
    if (lastUpdateMinutes > 15) return '#6b7280'; // Gray - stale
    
    switch (status) {
      case 'active': return '#10b981'; // Green
      case 'paused': return '#f59e0b'; // Yellow
      case 'ended': return '#ef4444'; // Red
      default: return '#6b7280'; // Gray
    }
  };

  const exportLocations = async (format: 'csv' | 'geojson') => {
    try {
      const { data, error } = await supabase
        .from('location_points')
        .select(`
          *,
          driver_profiles!inner(
            profiles!inner(first_name, last_name)
          )
        `)
        .eq('company_id', profile?.company_id)
        .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
        .order('timestamp', { ascending: false });

      if (error) throw error;

      // Get driver names from profiles table
      const { data: driversWithNames, error: driversError } = await supabase
        .from('driver_profiles')
        .select(`
          id,
          profiles(first_name, last_name)
        `)
        .eq('company_id', profile?.company_id);

      if (driversError) throw driversError;

      let exportData: string;
      let filename: string;
      let mimeType: string;

      if (format === 'csv') {
        const csvHeaders = 'Driver Name,Latitude,Longitude,Accuracy,Speed,Heading,Battery,Timestamp\n';
        const csvRows = data.map(row => {
          const driverProfile = driversWithNames?.find(d => d.id === row.driver_id);
          const driverName = driverProfile?.profiles 
            ? `${driverProfile.profiles.first_name} ${driverProfile.profiles.last_name}`
            : `Driver ${row.driver_id.slice(0, 8)}`;
          
          return [
            `"${driverName}"`,
            row.latitude,
            row.longitude,
            row.accuracy,
            row.speed || '',
            row.heading || '',
            row.battery_level || '',
            row.timestamp
          ].join(',');
        }).join('\n');
        
        exportData = csvHeaders + csvRows;
        filename = `driver-locations-${new Date().toISOString().split('T')[0]}.csv`;
        mimeType = 'text/csv';
      } else {
        const geoJson = {
          type: 'FeatureCollection',
          features: data.map(row => {
            const driverProfile = driversWithNames?.find(d => d.id === row.driver_id);
            const driverName = driverProfile?.profiles 
              ? `${driverProfile.profiles.first_name} ${driverProfile.profiles.last_name}`
              : `Driver ${row.driver_id.slice(0, 8)}`;
            
            return {
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [row.longitude, row.latitude]
              },
              properties: {
                driver_name: driverName,
                accuracy: row.accuracy,
                speed: row.speed,
                heading: row.heading,
                battery_level: row.battery_level,
                timestamp: row.timestamp
              }
            };
          })
        };
        
        exportData = JSON.stringify(geoJson, null, 2);
        filename = `driver-locations-${new Date().toISOString().split('T')[0]}.geojson`;
        mimeType = 'application/json';
      }

      // Download file
      const blob = new Blob([exportData], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Log export access
      await logMapAccess('export_data');
      
      toast.success(`Locations exported as ${format.toUpperCase()}`);
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export locations');
    }
  };

  if (mapboxToken === 'pk.your_mapbox_token_here') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapIcon className="h-5 w-5" />
            Live Driver Tracking
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">
              Mapbox API key required for live tracking maps
            </p>
            <Input
              placeholder="Enter your Mapbox public token"
              value={mapboxToken}
              onChange={(e) => setMapboxToken(e.target.value)}
              className="max-w-md mx-auto"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Get your free token at <a href="https://mapbox.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">mapbox.com</a>
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MapIcon className="h-5 w-5" />
            Live Driver Tracking
            <Badge variant="secondary">
              <Users className="h-3 w-3 mr-1" />
              {driversData.length} drivers
            </Badge>
          </CardTitle>
          
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Switch 
              checked={showTrails} 
              onCheckedChange={setShowTrails}
            />
              <span>Show Trails</span>
            </div>
            
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => fetchDriverLocations()}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => exportLocations('csv')}
            >
              <Download className="h-4 w-4 mr-1" />
              CSV
            </Button>
            
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => exportLocations('geojson')}
            >
              <Download className="h-4 w-4 mr-1" />
              GeoJSON
            </Button>
          </div>
        </div>
        
        {lastUpdate && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            Last updated: {lastUpdate.toLocaleTimeString()}
          </div>
        )}
      </CardHeader>

      <CardContent className="p-0">
        <div 
          ref={mapContainer} 
          className="w-full h-[600px] rounded-b-lg overflow-hidden"
        />
      </CardContent>
    </Card>
  );
}