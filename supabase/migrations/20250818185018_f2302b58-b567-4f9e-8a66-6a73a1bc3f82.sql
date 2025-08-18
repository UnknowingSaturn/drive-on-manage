-- Add RLS policy for admins to view end_of_day_reports
CREATE POLICY "Admins can view EOD reports in their companies" 
ON public.end_of_day_reports 
FOR SELECT 
USING (driver_id IN (
  SELECT dp.id 
  FROM driver_profiles dp 
  WHERE dp.company_id IN (
    SELECT uc.company_id 
    FROM user_companies uc 
    WHERE uc.user_id = auth.uid() AND uc.role = 'admin'
  )
));

-- Update EOD reports table structure to match what's expected
ALTER TABLE public.end_of_day_reports 
ADD COLUMN IF NOT EXISTS round_start_time timestamp with time zone,
ADD COLUMN IF NOT EXISTS round_end_time timestamp with time zone;