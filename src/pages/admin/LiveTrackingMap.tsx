import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  MapPin, 
  Download, 
  Filter, 
  Users, 
  Navigation,
  Battery,
  Clock,
  Truck,
  Calendar,
  FileText
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { format, subDays, subHours } from 'date-fns';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

interface DriverLocation {
  id: string;
  driver_id: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  battery_level?: number;
  timestamp: string;
  driver_name: string;
  driver_email: string;
  assigned_round?: string;
  status: 'active' | 'idle' | 'offline';
}

interface MapFilters {
  showTrails: boolean;
  trailDuration: number; // minutes
  selectedDriver: string;
  timeRange: string;
  showOffline: boolean;
}

const LiveTrackingMap = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<Map<string, mapboxgl.Marker>>(new Map());
  
  const [filters, setFilters] = useState<MapFilters>({
    showTrails: false,
    trailDuration: 60,
    selectedDriver: 'all',
    timeRange: '1h',
    showOffline: true,
  });

  // Fetch drivers for filter dropdown
  const { data: drivers } = useQuery({
    queryKey: ['tracking-drivers', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];

      const { data, error } = await supabase
        .from('driver_profiles')
        .select(`
          id,
          profiles!inner(first_name, last_name, email)
        `)
        .eq('company_id', profile.company_id)
        .eq('status', 'active');

      if (error) throw error;
      return data;
    },
    enabled: !!profile?.company_id,
  });

  // Fetch live location data
  const { data: locations = [], isLoading } = useQuery({
    queryKey: ['live-locations', profile?.company_id, filters],
    queryFn: async () => {
      if (!profile?.company_id) return [];

      const timeThreshold = new Date();
      switch (filters.timeRange) {
        case '15m': timeThreshold.setMinutes(timeThreshold.getMinutes() - 15); break;
        case '1h': timeThreshold.setHours(timeThreshold.getHours() - 1); break;
        case '4h': timeThreshold.setHours(timeThreshold.getHours() - 4); break;
        case '24h': timeThreshold.setHours(timeThreshold.getHours() - 24); break;
        default: timeThreshold.setHours(timeThreshold.getHours() - 1);
      }

      let query = supabase
        .from('location_points')
        .select(`
          id,
          driver_id,
          latitude,
          longitude,
          accuracy,
          speed,
          heading,
          battery_level,
          timestamp
        `)
        .eq('company_id', profile.company_id)
        .gte('timestamp', timeThreshold.toISOString())
        .order('timestamp', { ascending: false });

      if (filters.selectedDriver !== 'all') {
        query = query.eq('driver_id', filters.selectedDriver);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Get driver profiles separately
      const driverIds = [...new Set(data?.map(p => p.driver_id) || [])];
      const { data: driverProfiles } = await supabase
        .from('driver_profiles')
        .select(`
          id,
          profiles!inner(first_name, last_name, email)
        `)
        .in('id', driverIds);

      // Group by driver and get latest location for each
      const driverLocationMap = new Map<string, any>();
      
      data?.forEach((point) => {
        const driverId = point.driver_id;
        const existing = driverLocationMap.get(driverId);
        
        if (!existing || new Date(point.timestamp) > new Date(existing.timestamp)) {
          const driverProfile = driverProfiles?.find(dp => dp.id === driverId);
          driverLocationMap.set(driverId, {
            ...point,
            driver_name: driverProfile ? 
              `${driverProfile.profiles.first_name} ${driverProfile.profiles.last_name}` : 
              'Unknown Driver',
            driver_email: driverProfile?.profiles.email || '',
          });
        }
      });

      // Determine status based on last update time
      const now = new Date();
      return Array.from(driverLocationMap.values()).map((location) => {
        const lastUpdate = new Date(location.timestamp);
        const minutesSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60);
        
        let status: 'active' | 'idle' | 'offline' = 'offline';
        if (minutesSinceUpdate < 5) status = 'active';
        else if (minutesSinceUpdate < 30) status = 'idle';
        
        return { ...location, status };
      }).filter(location => filters.showOffline || location.status !== 'offline');
    },
    enabled: !!profile?.company_id,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Initialize Mapbox
  useEffect(() => {
    if (!mapContainer.current) return;

    // Initialize map with fallback token
    const mapboxToken = 'pk.eyJ1IjoiZW9kcml2ZSIsImEiOiJjbHpkb256ZGYwMW9iMnFweTB1dGU1aHF1In0.dTrAHjqmqGb-BPV4JZKJeA';
    mapboxgl.accessToken = mapboxToken;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [-2.3, 53.4], // UK center
      zoom: 6,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    map.current.addControl(new mapboxgl.FullscreenControl(), 'top-right');

    return () => {
      map.current?.remove();
    };
  }, []);

  // Update map markers when locations change
  useEffect(() => {
    if (!map.current || !locations) return;

    // Clear existing markers
    markers.current.forEach(marker => marker.remove());
    markers.current.clear();

    // Add new markers
    locations.forEach((location) => {
      const el = document.createElement('div');
      el.className = 'location-marker';
      el.style.width = '24px';
      el.style.height = '24px';
      el.style.borderRadius = '50%';
      el.style.border = '3px solid white';
      el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
      el.style.cursor = 'pointer';
      
      // Set color based on status
      switch (location.status) {
        case 'active':
          el.style.backgroundColor = '#10b981'; // green
          break;
        case 'idle':
          el.style.backgroundColor = '#f59e0b'; // yellow
          break;
        case 'offline':
          el.style.backgroundColor = '#ef4444'; // red
          break;
      }

      // Create popup content
      const popup = new mapboxgl.Popup({ offset: 25 })
        .setHTML(`
          <div class="p-3 min-w-[200px]">
            <div class="font-semibold text-base mb-2">${location.driver_name}</div>
            <div class="space-y-1 text-sm">
              <div class="flex justify-between">
                <span class="text-gray-600">Status:</span>
                <span class="font-medium ${
                  location.status === 'active' ? 'text-green-600' : 
                  location.status === 'idle' ? 'text-yellow-600' : 'text-red-600'
                }">${location.status.charAt(0).toUpperCase() + location.status.slice(1)}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600">Last Update:</span>
                <span>${format(new Date(location.timestamp), 'HH:mm:ss')}</span>
              </div>
              ${location.speed !== null ? `
                <div class="flex justify-between">
                  <span class="text-gray-600">Speed:</span>
                  <span>${Math.round((location.speed || 0) * 3.6)} km/h</span>
                </div>
              ` : ''}
              ${location.battery_level ? `
                <div class="flex justify-between">
                  <span class="text-gray-600">Battery:</span>
                  <span>${location.battery_level}%</span>
                </div>
              ` : ''}
              <div class="flex justify-between">
                <span class="text-gray-600">Accuracy:</span>
                <span>±${Math.round(location.accuracy || 0)}m</span>
              </div>
            </div>
          </div>
        `);

      const marker = new mapboxgl.Marker(el)
        .setLngLat([location.longitude, location.latitude])
        .setPopup(popup)
        .addTo(map.current!);

      markers.current.set(location.driver_id, marker);
    });

    // Fit map to show all markers if we have locations
    if (locations.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      locations.forEach(location => {
        bounds.extend([location.longitude, location.latitude]);
      });
      
      map.current.fitBounds(bounds, {
        padding: 50,
        maxZoom: 15,
      });
    }
  }, [locations]);

  // Export functions
  const exportToCSV = () => {
    if (!locations.length) {
      toast({
        title: "No Data",
        description: "No location data available to export.",
        variant: "destructive",
      });
      return;
    }

    const csvHeaders = [
      'Driver Name',
      'Email',
      'Latitude',
      'Longitude',
      'Speed (km/h)',
      'Battery %',
      'Accuracy (m)',
      'Status',
      'Timestamp'
    ];

    const csvRows = locations.map(location => [
      location.driver_name,
      location.driver_email,
      location.latitude.toFixed(6),
      location.longitude.toFixed(6),
      location.speed ? (location.speed * 3.6).toFixed(1) : '',
      location.battery_level || '',
      location.accuracy ? Math.round(location.accuracy) : '',
      location.status,
      location.timestamp
    ]);

    const csvContent = [csvHeaders, ...csvRows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `driver-locations-${format(new Date(), 'yyyy-MM-dd-HHmm')}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Export Complete",
      description: "Location data exported to CSV file.",
    });
  };

  const exportToGeoJSON = () => {
    if (!locations.length) {
      toast({
        title: "No Data",
        description: "No location data available to export.",
        variant: "destructive",
      });
      return;
    }

    const geoJson = {
      type: 'FeatureCollection',
      features: locations.map(location => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [location.longitude, location.latitude]
        },
        properties: {
          driver_name: location.driver_name,
          driver_email: location.driver_email,
          speed_kmh: location.speed ? (location.speed * 3.6).toFixed(1) : null,
          battery_level: location.battery_level,
          accuracy_m: location.accuracy ? Math.round(location.accuracy) : null,
          status: location.status,
          timestamp: location.timestamp
        }
      }))
    };

    const blob = new Blob([JSON.stringify(geoJson, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `driver-locations-${format(new Date(), 'yyyy-MM-dd-HHmm')}.geojson`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Export Complete",
      description: "Location data exported to GeoJSON file.",
    });
  };

  const activeCount = locations.filter(l => l.status === 'active').length;
  const idleCount = locations.filter(l => l.status === 'idle').length;
  const offlineCount = locations.filter(l => l.status === 'offline').length;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <SidebarInset className="flex-1">
          <div className="flex flex-col h-screen">
            {/* Header */}
            <div className="flex items-center gap-4 border-b px-6 py-4">
              <SidebarTrigger />
              <div className="flex-1">
                <h1 className="text-2xl font-bold">Live Driver Tracking</h1>
                <p className="text-muted-foreground">
                  Real-time location monitoring for active drivers
                </p>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="bg-green-500">
                    <div className="w-2 h-2 bg-white rounded-full mr-1" />
                    Active: {activeCount}
                  </Badge>
                  <Badge variant="secondary" className="bg-yellow-500">
                    <div className="w-2 h-2 bg-white rounded-full mr-1" />
                    Idle: {idleCount}
                  </Badge>
                  <Badge variant="outline" className="bg-red-500 text-white">
                    <div className="w-2 h-2 bg-white rounded-full mr-1" />
                    Offline: {offlineCount}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="flex flex-1">
              {/* Filters Sidebar */}
              <div className="w-80 border-r bg-background p-4 space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Filter className="h-5 w-5" />
                      Filters
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Time Range */}
                    <div className="space-y-2">
                      <Label>Time Range</Label>
                      <Select 
                        value={filters.timeRange} 
                        onValueChange={(value) => setFilters(prev => ({ ...prev, timeRange: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="15m">Last 15 minutes</SelectItem>
                          <SelectItem value="1h">Last hour</SelectItem>
                          <SelectItem value="4h">Last 4 hours</SelectItem>
                          <SelectItem value="24h">Last 24 hours</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Driver Filter */}
                    <div className="space-y-2">
                      <Label>Driver</Label>
                      <Select 
                        value={filters.selectedDriver} 
                        onValueChange={(value) => setFilters(prev => ({ ...prev, selectedDriver: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Drivers</SelectItem>
                          {drivers?.map((driver) => (
                            <SelectItem key={driver.id} value={driver.id}>
                              {driver.profiles.first_name} {driver.profiles.last_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Separator />

                    {/* Options */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="show-trails">Show Trails</Label>
                        <Switch
                          id="show-trails"
                          checked={filters.showTrails}
                          onCheckedChange={(checked) => 
                            setFilters(prev => ({ ...prev, showTrails: checked }))
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <Label htmlFor="show-offline">Show Offline</Label>
                        <Switch
                          id="show-offline"
                          checked={filters.showOffline}
                          onCheckedChange={(checked) => 
                            setFilters(prev => ({ ...prev, showOffline: checked }))
                          }
                        />
                      </div>
                    </div>

                    <Separator />

                    {/* Export Options */}
                    <div className="space-y-2">
                      <Label>Export Data</Label>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={exportToCSV}
                          className="flex-1"
                        >
                          <FileText className="h-4 w-4 mr-1" />
                          CSV
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={exportToGeoJSON}
                          className="flex-1"
                        >
                          <MapPin className="h-4 w-4 mr-1" />
                          GeoJSON
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Map Container */}
              <div className="flex-1 relative">
                <div ref={mapContainer} className="w-full h-full" />
                
                {isLoading && (
                  <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                      <p>Loading location data...</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default LiveTrackingMap;