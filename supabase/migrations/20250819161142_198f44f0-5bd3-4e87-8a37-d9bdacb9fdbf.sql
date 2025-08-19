-- Create location points table for real-time GPS tracking
CREATE TABLE public.location_points (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL REFERENCES driver_profiles(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  shift_id UUID REFERENCES driver_shifts(id) ON DELETE SET NULL,
  latitude NUMERIC NOT NULL,
  longitude NUMERIC NOT NULL,
  accuracy NUMERIC,
  speed NUMERIC,
  heading NUMERIC,
  battery_level INTEGER,
  activity_type TEXT DEFAULT 'automotive',
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_offline_sync BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create location stats daily table for aggregated data
CREATE TABLE public.location_stats_daily (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL REFERENCES driver_profiles(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  stat_date DATE NOT NULL,
  total_distance NUMERIC NOT NULL DEFAULT 0,
  total_points INTEGER NOT NULL DEFAULT 0,
  active_hours NUMERIC NOT NULL DEFAULT 0,
  average_speed NUMERIC,
  max_speed NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create location access logs table for audit trail
CREATE TABLE public.location_access_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES driver_profiles(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  date_range_start DATE,
  date_range_end DATE,
  export_format TEXT,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT
);

-- Enable Row Level Security
ALTER TABLE public.location_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_stats_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_access_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for location_points
CREATE POLICY "Drivers can insert their own location points" 
ON public.location_points 
FOR INSERT 
WITH CHECK (driver_id IN (
  SELECT dp.id FROM driver_profiles dp WHERE dp.user_id = auth.uid()
));

CREATE POLICY "Drivers can view their own location points" 
ON public.location_points 
FOR SELECT 
USING (driver_id IN (
  SELECT dp.id FROM driver_profiles dp WHERE dp.user_id = auth.uid()
));

CREATE POLICY "Management can view location points for their drivers" 
ON public.location_points 
FOR SELECT 
USING (company_id IN (
  SELECT uc.company_id FROM user_companies uc 
  WHERE uc.user_id = auth.uid() AND uc.role IN ('admin', 'supervisor')
));

-- Create RLS policies for location_stats_daily
CREATE POLICY "Drivers can view their own stats" 
ON public.location_stats_daily 
FOR SELECT 
USING (driver_id IN (
  SELECT dp.id FROM driver_profiles dp WHERE dp.user_id = auth.uid()
));

CREATE POLICY "Management can view stats for their drivers" 
ON public.location_stats_daily 
FOR SELECT 
USING (company_id IN (
  SELECT uc.company_id FROM user_companies uc 
  WHERE uc.user_id = auth.uid() AND uc.role IN ('admin', 'supervisor')
));

-- Create RLS policies for location_access_logs
CREATE POLICY "Users can insert their own access logs" 
ON public.location_access_logs 
FOR INSERT 
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view access logs for their company" 
ON public.location_access_logs 
FOR SELECT 
USING (company_id IN (
  SELECT uc.company_id FROM user_companies uc 
  WHERE uc.user_id = auth.uid() AND uc.role = 'admin'
));

-- Create indexes for performance
CREATE INDEX idx_location_points_driver_timestamp ON location_points(driver_id, timestamp DESC);
CREATE INDEX idx_location_points_company_timestamp ON location_points(company_id, timestamp DESC);
CREATE INDEX idx_location_points_shift ON location_points(shift_id);
CREATE INDEX idx_location_stats_driver_date ON location_stats_daily(driver_id, stat_date DESC);
CREATE INDEX idx_location_access_logs_company ON location_access_logs(company_id, timestamp DESC);

-- Create function to clean up old location data (30 days retention)
CREATE OR REPLACE FUNCTION public.cleanup_old_location_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
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