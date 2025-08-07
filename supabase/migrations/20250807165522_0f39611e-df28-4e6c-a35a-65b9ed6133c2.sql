-- Create EOD_Reports table
CREATE TABLE public.eod_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL,
  company_id UUID NOT NULL,
  van_id UUID,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  parcels_delivered INTEGER NOT NULL,
  screenshot_url TEXT,
  issues_reported TEXT,
  estimated_pay NUMERIC(10,2),
  actual_pay NUMERIC(10,2),
  admin_notes TEXT,
  status TEXT NOT NULL DEFAULT 'submitted',
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.eod_reports ENABLE ROW LEVEL SECURITY;

-- Create policies for EOD reports
CREATE POLICY "Drivers can insert their own EOD reports" 
ON public.eod_reports 
FOR INSERT 
WITH CHECK (driver_id IN (
  SELECT dp.id 
  FROM driver_profiles dp 
  WHERE dp.user_id = auth.uid()
));

CREATE POLICY "Drivers can view their own EOD reports" 
ON public.eod_reports 
FOR SELECT 
USING (driver_id IN (
  SELECT dp.id 
  FROM driver_profiles dp 
  WHERE dp.user_id = auth.uid()
));

CREATE POLICY "Admins can view EOD reports in their company" 
ON public.eod_reports 
FOR SELECT 
USING (company_id IN (
  SELECT profiles.company_id 
  FROM profiles 
  WHERE profiles.user_id = auth.uid() AND profiles.user_type = 'admin'
));

CREATE POLICY "Admins can update EOD reports in their company" 
ON public.eod_reports 
FOR UPDATE 
USING (company_id IN (
  SELECT profiles.company_id 
  FROM profiles 
  WHERE profiles.user_id = auth.uid() AND profiles.user_type = 'admin'
));

-- Create trigger for timestamp updates
CREATE TRIGGER update_eod_reports_updated_at
BEFORE UPDATE ON public.eod_reports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add unique constraint to prevent duplicate EOD reports per day
ALTER TABLE public.eod_reports 
ADD CONSTRAINT unique_driver_eod_date UNIQUE (driver_id, log_date);

-- Create storage bucket for EOD screenshots
INSERT INTO storage.buckets (id, name, public) 
VALUES ('eod-screenshots', 'eod-screenshots', false);

-- Create storage policies for EOD screenshots
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

CREATE POLICY "Admins can view EOD screenshots in their company" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'eod-screenshots' AND
  EXISTS (
    SELECT 1 FROM driver_profiles dp
    JOIN profiles p ON p.user_id = auth.uid()
    WHERE dp.user_id::text = (storage.foldername(name))[1]
    AND dp.company_id = p.company_id
    AND p.user_type = 'admin'
  )
);