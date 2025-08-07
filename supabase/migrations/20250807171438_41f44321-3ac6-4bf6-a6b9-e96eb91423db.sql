-- Create schedules table for weekly driver assignments
CREATE TABLE IF NOT EXISTS public.schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  round_id UUID NOT NULL,
  driver_id UUID NOT NULL,
  scheduled_date DATE NOT NULL,
  week_start_date DATE NOT NULL,
  driver_rate NUMERIC(8,2),
  status TEXT NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  
  UNIQUE(round_id, scheduled_date),
  
  CONSTRAINT fk_schedules_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT fk_schedules_round FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE,
  CONSTRAINT fk_schedules_driver FOREIGN KEY (driver_id) REFERENCES driver_profiles(id) ON DELETE CASCADE,
  CONSTRAINT valid_status CHECK (status IN ('scheduled', 'completed', 'cancelled'))
);

-- Enable RLS
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;

-- RLS policies for schedules
CREATE POLICY "Admins can manage schedules in their company"
ON public.schedules
FOR ALL
TO authenticated
USING (company_id IN (
  SELECT company_id FROM profiles 
  WHERE user_id = auth.uid() AND user_type = 'admin'
))
WITH CHECK (company_id IN (
  SELECT company_id FROM profiles 
  WHERE user_id = auth.uid() AND user_type = 'admin'
));

CREATE POLICY "Drivers can view their own schedules"
ON public.schedules
FOR SELECT
TO authenticated
USING (driver_id IN (
  SELECT id FROM driver_profiles 
  WHERE user_id = auth.uid()
));

-- Create trigger for updated_at
CREATE TRIGGER update_schedules_updated_at
  BEFORE UPDATE ON public.schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for performance
CREATE INDEX idx_schedules_company_week ON public.schedules(company_id, week_start_date);
CREATE INDEX idx_schedules_driver_date ON public.schedules(driver_id, scheduled_date);
CREATE INDEX idx_schedules_round_date ON public.schedules(round_id, scheduled_date);