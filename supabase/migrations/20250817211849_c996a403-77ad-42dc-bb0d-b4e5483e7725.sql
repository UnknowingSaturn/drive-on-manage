-- Create location tracking tables for EODrive geolocation system
CREATE TABLE IF NOT EXISTS public.location_points (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL,
  company_id UUID NOT NULL,
  shift_id UUID,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  accuracy DECIMAL(10, 2),
  speed DECIMAL(8, 2),
  heading DECIMAL(5, 2),
  battery_level INTEGER,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_offline_sync BOOLEAN DEFAULT false,
  activity_type TEXT DEFAULT 'automotive'
);

-- Create shift tracking table
CREATE TABLE IF NOT EXISTS public.driver_shifts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL,
  company_id UUID NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  end_time TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'ended')),
  consent_given BOOLEAN NOT NULL DEFAULT true,
  consent_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  total_distance DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create location access audit log
CREATE TABLE IF NOT EXISTS public.location_access_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_id UUID NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('view_map', 'export_data', 'view_trail')),
  driver_id UUID,
  date_range_start DATE,
  date_range_end DATE,
  export_format TEXT,
  ip_address TEXT,
  user_agent TEXT,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create aggregated location stats for retention policy
CREATE TABLE IF NOT EXISTS public.location_stats_daily (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL,
  company_id UUID NOT NULL,
  stat_date DATE NOT NULL,
  total_distance DECIMAL(10, 2) NOT NULL DEFAULT 0,
  active_hours DECIMAL(5, 2) NOT NULL DEFAULT 0,
  average_speed DECIMAL(8, 2),
  max_speed DECIMAL(8, 2),
  total_points INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.location_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_stats_daily ENABLE ROW LEVEL SECURITY;

-- RLS Policies for location_points
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

-- RLS Policies for driver_shifts
CREATE POLICY "Drivers can manage their own shifts" 
ON public.driver_shifts 
FOR ALL 
USING (driver_id IN (
  SELECT dp.id FROM driver_profiles dp WHERE dp.user_id = auth.uid()
))
WITH CHECK (driver_id IN (
  SELECT dp.id FROM driver_profiles dp WHERE dp.user_id = auth.uid()
));

CREATE POLICY "Management can view shifts for their drivers" 
ON public.driver_shifts 
FOR SELECT 
USING (company_id IN (
  SELECT uc.company_id FROM user_companies uc 
  WHERE uc.user_id = auth.uid() AND uc.role IN ('admin', 'supervisor')
));

-- RLS Policies for location_access_logs
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

-- RLS Policies for location_stats_daily
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

-- Create indexes for performance
CREATE INDEX idx_location_points_driver_timestamp ON public.location_points(driver_id, timestamp DESC);
CREATE INDEX idx_location_points_company_timestamp ON public.location_points(company_id, timestamp DESC);
CREATE INDEX idx_location_points_shift_id ON public.location_points(shift_id);
CREATE INDEX idx_driver_shifts_driver_status ON public.driver_shifts(driver_id, status);
CREATE INDEX idx_location_stats_driver_date ON public.location_stats_daily(driver_id, stat_date DESC);

-- Create function to update shift updated_at timestamp
CREATE OR REPLACE FUNCTION update_shift_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_driver_shifts_updated_at
  BEFORE UPDATE ON public.driver_shifts
  FOR EACH ROW
  EXECUTE FUNCTION update_shift_updated_at();

-- Create function for data retention (delete location points older than 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_location_data()
RETURNS void AS $$
BEGIN
  -- Delete location points older than 30 days
  DELETE FROM public.location_points 
  WHERE timestamp < now() - INTERVAL '30 days';
  
  -- Keep aggregated stats longer (1 year)
  DELETE FROM public.location_stats_daily 
  WHERE stat_date < CURRENT_DATE - INTERVAL '1 year';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;