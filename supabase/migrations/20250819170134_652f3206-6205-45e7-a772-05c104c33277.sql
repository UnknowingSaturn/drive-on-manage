-- Create driver_locations table for GPS tracking
CREATE TABLE public.driver_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL,
  company_id UUID NOT NULL,
  shift_id UUID,
  latitude NUMERIC NOT NULL,
  longitude NUMERIC NOT NULL,
  accuracy NUMERIC,
  speed NUMERIC,
  heading NUMERIC,
  battery_level INTEGER,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_offline_sync BOOLEAN DEFAULT false,
  activity_type TEXT DEFAULT 'automotive'
);

-- Create indexes for efficient geospatial queries
CREATE INDEX idx_driver_locations_driver_timestamp ON public.driver_locations(driver_id, timestamp DESC);
CREATE INDEX idx_driver_locations_company_timestamp ON public.driver_locations(company_id, timestamp DESC);
CREATE INDEX idx_driver_locations_timestamp ON public.driver_locations(timestamp);

-- Add RLS policies
ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;

-- Drivers can insert their own location points
CREATE POLICY "Drivers can insert their own location points" 
ON public.driver_locations 
FOR INSERT 
WITH CHECK (driver_id IN (
  SELECT dp.id FROM driver_profiles dp WHERE dp.user_id = auth.uid()
));

-- Drivers can view their own location points
CREATE POLICY "Drivers can view their own location points" 
ON public.driver_locations 
FOR SELECT 
USING (driver_id IN (
  SELECT dp.id FROM driver_profiles dp WHERE dp.user_id = auth.uid()
));

-- Management can view location points for their drivers
CREATE POLICY "Management can view location points for their drivers" 
ON public.driver_locations 
FOR SELECT 
USING (company_id IN (
  SELECT uc.company_id FROM user_companies uc 
  WHERE uc.user_id = auth.uid() 
  AND uc.role IN ('admin', 'supervisor')
));

-- Create daily stats aggregation table
CREATE TABLE public.location_stats_daily (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL,
  company_id UUID NOT NULL,
  stat_date DATE NOT NULL,
  total_distance NUMERIC NOT NULL DEFAULT 0,
  total_points INTEGER NOT NULL DEFAULT 0,
  active_hours NUMERIC NOT NULL DEFAULT 0,
  average_speed NUMERIC,
  max_speed NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add indexes for daily stats
CREATE INDEX idx_location_stats_daily_driver_date ON public.location_stats_daily(driver_id, stat_date DESC);
CREATE INDEX idx_location_stats_daily_company_date ON public.location_stats_daily(company_id, stat_date DESC);

-- RLS for daily stats
ALTER TABLE public.location_stats_daily ENABLE ROW LEVEL SECURITY;

-- Drivers can view their own stats
CREATE POLICY "Drivers can view their own stats" 
ON public.location_stats_daily 
FOR SELECT 
USING (driver_id IN (
  SELECT dp.id FROM driver_profiles dp WHERE dp.user_id = auth.uid()
));

-- Management can view stats for their drivers
CREATE POLICY "Management can view stats for their drivers" 
ON public.location_stats_daily 
FOR SELECT 
USING (company_id IN (
  SELECT uc.company_id FROM user_companies uc 
  WHERE uc.user_id = auth.uid() 
  AND uc.role IN ('admin', 'supervisor')
));

-- Create location access logs table for audit
CREATE TABLE public.location_access_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_id UUID NOT NULL,
  driver_id UUID,
  action_type TEXT NOT NULL, -- 'view', 'export', 'playback'
  date_range_start DATE,
  date_range_end DATE,
  export_format TEXT, -- 'csv', 'geojson'
  ip_address TEXT,
  user_agent TEXT,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS for access logs
ALTER TABLE public.location_access_logs ENABLE ROW LEVEL SECURITY;

-- Users can insert their own access logs
CREATE POLICY "Users can insert their own access logs" 
ON public.location_access_logs 
FOR INSERT 
WITH CHECK (user_id = auth.uid());

-- Admins can view access logs for their company
CREATE POLICY "Admins can view access logs for their company" 
ON public.location_access_logs 
FOR SELECT 
USING (company_id IN (
  SELECT uc.company_id FROM user_companies uc 
  WHERE uc.user_id = auth.uid() 
  AND uc.role = 'admin'
));

-- Create function to cleanup old location data (30 days retention)
CREATE OR REPLACE FUNCTION public.cleanup_old_location_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Delete location points older than 30 days
  DELETE FROM public.location_points 
  WHERE timestamp < now() - INTERVAL '30 days';
  
  -- Keep aggregated stats longer (1 year)
  DELETE FROM public.location_stats_daily 
  WHERE stat_date < CURRENT_DATE - INTERVAL '1 year';
END;
$$;