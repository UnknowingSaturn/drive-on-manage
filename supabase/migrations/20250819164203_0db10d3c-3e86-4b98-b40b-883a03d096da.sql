-- Update end_of_day_reports table
ALTER TABLE public.end_of_day_reports 
DROP COLUMN submitted_at,
DROP COLUMN screenshot_url,
ADD COLUMN screenshot_path text;

-- Update start_of_day_reports table  
ALTER TABLE public.start_of_day_reports
DROP COLUMN submitted_at,
ADD COLUMN total_deliveries integer DEFAULT 0,
ADD COLUMN total_collections integer DEFAULT 0;

-- Update storage bucket policies to make eod-screenshots public
UPDATE storage.buckets 
SET public = true 
WHERE id = 'eod-screenshots';

-- Create policy for public access to eod-screenshots
CREATE POLICY "EOD screenshots are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'eod-screenshots');

-- Update existing RLS policies to use created_at instead of submitted_at
DROP POLICY IF EXISTS "Drivers can insert their own EOD reports" ON public.end_of_day_reports;
DROP POLICY IF EXISTS "Drivers can insert their own SOD reports" ON public.start_of_day_reports;

CREATE POLICY "Drivers can insert their own EOD reports" 
ON public.end_of_day_reports 
FOR INSERT 
WITH CHECK (driver_id IN (
  SELECT dp.id FROM driver_profiles dp WHERE dp.user_id = auth.uid()
));

CREATE POLICY "Drivers can insert their own SOD reports" 
ON public.start_of_day_reports 
FOR INSERT 
WITH CHECK (driver_id IN (
  SELECT dp.id FROM driver_profiles dp WHERE dp.user_id = auth.uid()
));