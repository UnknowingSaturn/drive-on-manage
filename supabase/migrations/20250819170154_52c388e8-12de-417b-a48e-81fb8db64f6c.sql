-- Create location access logs table for audit (since this wasn't created)
DROP TABLE IF EXISTS public.location_access_logs;
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