-- Fix Start of Day and End of Day Reports Schema
-- Drop and recreate tables with proper structure matching requirements

-- Drop existing tables and constraints
DROP TABLE IF EXISTS start_of_day_reports CASCADE;
DROP TABLE IF EXISTS end_of_day_reports CASCADE;

-- Create Start of Day Reports table
CREATE TABLE public.start_of_day_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL,
  company_id UUID NOT NULL,
  driver_name TEXT NOT NULL,
  round_number TEXT NOT NULL,
  extracted_round_number TEXT,
  heavy_parcels INTEGER DEFAULT 0,
  standard INTEGER DEFAULT 0,
  hanging_garments INTEGER DEFAULT 0,
  packets INTEGER DEFAULT 0,
  small_packets INTEGER DEFAULT 0,
  postables INTEGER DEFAULT 0,
  screenshot_url TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processing_status TEXT DEFAULT 'pending',
  vision_api_response JSONB
);

-- Create End of Day Reports table  
CREATE TABLE public.end_of_day_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL,
  company_id UUID NOT NULL,
  driver_name TEXT NOT NULL,
  round1_number TEXT,
  round2_number TEXT,
  round3_number TEXT,
  round4_number TEXT,
  support BOOLEAN NOT NULL DEFAULT false,
  support_parcels INTEGER DEFAULT 0,
  successful_deliveries INTEGER NOT NULL DEFAULT 0,
  successful_collections INTEGER NOT NULL DEFAULT 0,
  company_van BOOLEAN NOT NULL DEFAULT false,
  van_registration TEXT,
  total_parcels INTEGER,
  round_start_time TIME,
  round_end_time TIME,
  screenshot_url TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processing_status TEXT DEFAULT 'pending',
  vision_api_response JSONB
);

-- Add foreign key constraints
ALTER TABLE public.start_of_day_reports 
ADD CONSTRAINT start_of_day_reports_driver_id_fkey 
FOREIGN KEY (driver_id) REFERENCES driver_profiles(id) ON DELETE CASCADE;

ALTER TABLE public.start_of_day_reports 
ADD CONSTRAINT start_of_day_reports_company_id_fkey 
FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE public.end_of_day_reports 
ADD CONSTRAINT end_of_day_reports_driver_id_fkey 
FOREIGN KEY (driver_id) REFERENCES driver_profiles(id) ON DELETE CASCADE;

ALTER TABLE public.end_of_day_reports 
ADD CONSTRAINT end_of_day_reports_company_id_fkey 
FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

-- Enable Row Level Security
ALTER TABLE public.start_of_day_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.end_of_day_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Start of Day Reports
CREATE POLICY "Drivers can insert their own SOD reports" 
ON public.start_of_day_reports FOR INSERT 
WITH CHECK (driver_id IN (
  SELECT dp.id FROM driver_profiles dp WHERE dp.user_id = auth.uid()
));

CREATE POLICY "Drivers can view their own SOD reports" 
ON public.start_of_day_reports FOR SELECT 
USING (driver_id IN (
  SELECT dp.id FROM driver_profiles dp WHERE dp.user_id = auth.uid()
));

CREATE POLICY "Admins can view SOD reports in their companies" 
ON public.start_of_day_reports FOR SELECT 
USING (company_id IN (
  SELECT uc.company_id FROM user_companies uc 
  WHERE uc.user_id = auth.uid() AND uc.role = 'admin'
));

CREATE POLICY "Admins can update SOD reports in their companies" 
ON public.start_of_day_reports FOR UPDATE 
USING (company_id IN (
  SELECT uc.company_id FROM user_companies uc 
  WHERE uc.user_id = auth.uid() AND uc.role = 'admin'
))
WITH CHECK (company_id IN (
  SELECT uc.company_id FROM user_companies uc 
  WHERE uc.user_id = auth.uid() AND uc.role = 'admin'
));

-- RLS Policies for End of Day Reports
CREATE POLICY "Drivers can insert their own EOD reports" 
ON public.end_of_day_reports FOR INSERT 
WITH CHECK (driver_id IN (
  SELECT dp.id FROM driver_profiles dp WHERE dp.user_id = auth.uid()
));

CREATE POLICY "Drivers can view their own EOD reports" 
ON public.end_of_day_reports FOR SELECT 
USING (driver_id IN (
  SELECT dp.id FROM driver_profiles dp WHERE dp.user_id = auth.uid()
));

CREATE POLICY "Admins can view EOD reports in their companies" 
ON public.end_of_day_reports FOR SELECT 
USING (company_id IN (
  SELECT uc.company_id FROM user_companies uc 
  WHERE uc.user_id = auth.uid() AND uc.role = 'admin'
));

CREATE POLICY "Admins can update EOD reports in their companies" 
ON public.end_of_day_reports FOR UPDATE 
USING (company_id IN (
  SELECT uc.company_id FROM user_companies uc 
  WHERE uc.user_id = auth.uid() AND uc.role = 'admin'
))
WITH CHECK (company_id IN (
  SELECT uc.company_id FROM user_companies uc 
  WHERE uc.user_id = auth.uid() AND uc.role = 'admin'
));

-- Create indexes for performance
CREATE INDEX idx_start_of_day_reports_driver_id ON public.start_of_day_reports(driver_id);
CREATE INDEX idx_start_of_day_reports_company_id ON public.start_of_day_reports(company_id);
CREATE INDEX idx_start_of_day_reports_submitted_at ON public.start_of_day_reports(submitted_at);

CREATE INDEX idx_end_of_day_reports_driver_id ON public.end_of_day_reports(driver_id);
CREATE INDEX idx_end_of_day_reports_company_id ON public.end_of_day_reports(company_id);
CREATE INDEX idx_end_of_day_reports_submitted_at ON public.end_of_day_reports(submitted_at);

-- Update triggers for timestamps
CREATE TRIGGER update_start_of_day_reports_updated_at
  BEFORE UPDATE ON public.start_of_day_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_end_of_day_reports_updated_at
  BEFORE UPDATE ON public.end_of_day_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();