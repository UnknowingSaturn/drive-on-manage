-- Create SOD_Logs table for Start of Day logging
CREATE TABLE public.sod_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL,
  company_id UUID NOT NULL,
  van_id UUID,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  parcel_count INTEGER NOT NULL,
  starting_mileage INTEGER NOT NULL,
  vehicle_check_completed BOOLEAN NOT NULL DEFAULT false,
  vehicle_check_items JSONB DEFAULT '{}',
  van_confirmed BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sod_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for SOD logs
CREATE POLICY "Drivers can insert their own SOD logs" 
ON public.sod_logs 
FOR INSERT 
WITH CHECK (driver_id IN (
  SELECT dp.id 
  FROM driver_profiles dp 
  WHERE dp.user_id = auth.uid()
));

CREATE POLICY "Drivers can view their own SOD logs" 
ON public.sod_logs 
FOR SELECT 
USING (driver_id IN (
  SELECT dp.id 
  FROM driver_profiles dp 
  WHERE dp.user_id = auth.uid()
));

CREATE POLICY "Admins can view SOD logs in their company" 
ON public.sod_logs 
FOR SELECT 
USING (company_id IN (
  SELECT profiles.company_id 
  FROM profiles 
  WHERE profiles.user_id = auth.uid() AND profiles.user_type = 'admin'
));

-- Create trigger for timestamp updates
CREATE TRIGGER update_sod_logs_updated_at
BEFORE UPDATE ON public.sod_logs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add unique constraint to prevent duplicate SOD logs per day
ALTER TABLE public.sod_logs 
ADD CONSTRAINT unique_driver_date UNIQUE (driver_id, log_date);