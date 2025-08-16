-- Create new end_of_day_reports table
CREATE TABLE public.end_of_day_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL REFERENCES public.driver_profiles(id) ON DELETE CASCADE,
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  name TEXT NOT NULL,
  round_1_number TEXT,
  round_2_number TEXT,
  round_3_number TEXT,
  round_4_number TEXT,
  did_support BOOLEAN NOT NULL DEFAULT false,
  support_parcels INTEGER NOT NULL DEFAULT 0,
  successful_deliveries INTEGER NOT NULL DEFAULT 0,
  successful_collections INTEGER NOT NULL DEFAULT 0,
  has_company_van BOOLEAN NOT NULL DEFAULT false,
  van_registration TEXT,
  total_parcels INTEGER GENERATED ALWAYS AS (successful_deliveries + successful_collections + support_parcels) STORED,
  round_start_time TIMESTAMP WITH TIME ZONE,
  round_end_time TIMESTAMP WITH TIME ZONE,
  app_screenshot TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.end_of_day_reports ENABLE ROW LEVEL SECURITY;

-- RLS policies for drivers to manage their own reports
CREATE POLICY "Drivers can insert their own EOD reports" 
ON public.end_of_day_reports 
FOR INSERT 
WITH CHECK (driver_id IN (
  SELECT dp.id FROM driver_profiles dp WHERE dp.user_id = auth.uid()
));

CREATE POLICY "Drivers can view their own EOD reports" 
ON public.end_of_day_reports 
FOR SELECT 
USING (driver_id IN (
  SELECT dp.id FROM driver_profiles dp WHERE dp.user_id = auth.uid()
));

-- RLS policies for admins
CREATE POLICY "Admins can view EOD reports in their companies" 
ON public.end_of_day_reports 
FOR SELECT 
USING (driver_id IN (
  SELECT dp.id FROM driver_profiles dp 
  WHERE dp.company_id IN (
    SELECT uc.company_id FROM user_companies uc 
    WHERE uc.user_id = auth.uid() AND uc.role = 'admin'
  )
));

CREATE POLICY "Admins can update EOD reports in their companies" 
ON public.end_of_day_reports 
FOR UPDATE 
USING (driver_id IN (
  SELECT dp.id FROM driver_profiles dp 
  WHERE dp.company_id IN (
    SELECT uc.company_id FROM user_companies uc 
    WHERE uc.user_id = auth.uid() AND uc.role = 'admin'
  )
));

-- Create updated_at trigger
CREATE TRIGGER update_end_of_day_reports_updated_at
  BEFORE UPDATE ON public.end_of_day_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for EOD screenshots if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('eod-screenshots', 'eod-screenshots', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for EOD screenshots
CREATE POLICY "Drivers can upload their own EOD screenshots" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'eod-screenshots' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Drivers can view their own EOD screenshots" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'eod-screenshots' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Admins can view EOD screenshots in their companies" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'eod-screenshots' AND 
  EXISTS (
    SELECT 1 FROM driver_profiles dp 
    JOIN user_companies uc ON dp.company_id = uc.company_id
    WHERE dp.user_id::text = (storage.foldername(name))[1]
    AND uc.user_id = auth.uid() 
    AND uc.role = 'admin'
  )
);