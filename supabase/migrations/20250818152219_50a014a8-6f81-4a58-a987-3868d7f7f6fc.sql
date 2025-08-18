-- Create StartOfDayReports table with enhanced fields
CREATE TABLE IF NOT EXISTS public.start_of_day_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL REFERENCES public.driver_profiles(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  round_number TEXT NOT NULL,
  extracted_round_number TEXT,
  heavy_parcels INTEGER DEFAULT 0,
  standard INTEGER DEFAULT 0,
  hanging_garments INTEGER DEFAULT 0,
  packets INTEGER DEFAULT 0,
  small_packets INTEGER DEFAULT 0,
  postables INTEGER DEFAULT 0,
  screenshot_url TEXT,
  vision_api_response JSONB,
  processing_status TEXT DEFAULT 'pending',
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS on the table
ALTER TABLE public.start_of_day_reports ENABLE ROW LEVEL SECURITY;

-- Create policies for the table
CREATE POLICY "Drivers can insert their own SOD reports" 
ON public.start_of_day_reports 
FOR INSERT 
WITH CHECK (driver_id IN (
  SELECT dp.id FROM driver_profiles dp WHERE dp.user_id = auth.uid()
));

CREATE POLICY "Drivers can view their own SOD reports" 
ON public.start_of_day_reports 
FOR SELECT 
USING (driver_id IN (
  SELECT dp.id FROM driver_profiles dp WHERE dp.user_id = auth.uid()
));

CREATE POLICY "Admins can view SOD reports in their companies" 
ON public.start_of_day_reports 
FOR SELECT 
USING (company_id IN (
  SELECT uc.company_id FROM user_companies uc 
  WHERE uc.user_id = auth.uid() AND uc.role = 'admin'
));

-- Create updated_at trigger
CREATE TRIGGER update_start_of_day_reports_updated_at
  BEFORE UPDATE ON public.start_of_day_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for SOD screenshots
INSERT INTO storage.buckets (id, name, public) VALUES ('sod-screenshots', 'sod-screenshots', false) ON CONFLICT DO NOTHING;

-- Create storage policies for SOD screenshots
CREATE POLICY "Drivers can upload their own SOD screenshots" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'sod-screenshots' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Drivers can view their own SOD screenshots" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'sod-screenshots' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Admins can view SOD screenshots in their companies" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'sod-screenshots' AND
  EXISTS (
    SELECT 1 FROM driver_profiles dp
    JOIN user_companies uc ON dp.company_id = uc.company_id
    WHERE dp.user_id::text = (storage.foldername(name))[1]
    AND uc.user_id = auth.uid() 
    AND uc.role = 'admin'
  )
);