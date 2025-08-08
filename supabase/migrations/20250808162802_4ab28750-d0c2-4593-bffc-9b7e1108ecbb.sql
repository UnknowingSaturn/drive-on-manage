-- Create route feedback table
CREATE TABLE public.route_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL,
  company_id UUID NOT NULL,
  round_id UUID,
  eod_report_id UUID,
  route_difficulty INTEGER CHECK (route_difficulty >= 1 AND route_difficulty <= 5),
  traffic_rating INTEGER CHECK (traffic_rating >= 1 AND traffic_rating <= 5),
  depot_experience INTEGER CHECK (depot_experience >= 1 AND depot_experience <= 5),
  notes TEXT,
  feedback_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create driver achievements table
CREATE TABLE public.driver_achievements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL,
  company_id UUID NOT NULL,
  achievement_type TEXT NOT NULL,
  achievement_name TEXT NOT NULL,
  description TEXT,
  earned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  progress_value INTEGER DEFAULT 0,
  target_value INTEGER DEFAULT 0,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  badge_icon TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create driver expenses table
CREATE TABLE public.driver_expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL,
  company_id UUID NOT NULL,
  expense_type TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  receipt_url TEXT,
  description TEXT,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_approved BOOLEAN DEFAULT NULL,
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create earnings tracking table
CREATE TABLE public.driver_earnings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL,
  company_id UUID NOT NULL,
  eod_report_id UUID,
  base_pay NUMERIC DEFAULT 0,
  parcel_pay NUMERIC DEFAULT 0,
  bonus_pay NUMERIC DEFAULT 0,
  overtime_pay NUMERIC DEFAULT 0,
  adjustments NUMERIC DEFAULT 0,
  total_earnings NUMERIC NOT NULL,
  earning_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.route_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_earnings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for route_feedback
CREATE POLICY "Drivers can insert their own feedback" 
ON public.route_feedback 
FOR INSERT 
WITH CHECK (driver_id IN (SELECT dp.id FROM driver_profiles dp WHERE dp.user_id = auth.uid()));

CREATE POLICY "Drivers can view their own feedback" 
ON public.route_feedback 
FOR SELECT 
USING (driver_id IN (SELECT dp.id FROM driver_profiles dp WHERE dp.user_id = auth.uid()));

CREATE POLICY "Admins can view feedback in their company" 
ON public.route_feedback 
FOR SELECT 
USING (company_id IN (SELECT profiles.company_id FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.user_type = 'admin'));

-- RLS Policies for driver_achievements
CREATE POLICY "Drivers can view their own achievements" 
ON public.driver_achievements 
FOR SELECT 
USING (driver_id IN (SELECT dp.id FROM driver_profiles dp WHERE dp.user_id = auth.uid()));

CREATE POLICY "Admins can manage achievements in their company" 
ON public.driver_achievements 
FOR ALL 
USING (company_id IN (SELECT profiles.company_id FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.user_type = 'admin'))
WITH CHECK (company_id IN (SELECT profiles.company_id FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.user_type = 'admin'));

-- RLS Policies for driver_expenses
CREATE POLICY "Drivers can manage their own expenses" 
ON public.driver_expenses 
FOR ALL 
USING (driver_id IN (SELECT dp.id FROM driver_profiles dp WHERE dp.user_id = auth.uid()))
WITH CHECK (driver_id IN (SELECT dp.id FROM driver_profiles dp WHERE dp.user_id = auth.uid()));

CREATE POLICY "Admins can manage expenses in their company" 
ON public.driver_expenses 
FOR ALL 
USING (company_id IN (SELECT profiles.company_id FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.user_type = 'admin'))
WITH CHECK (company_id IN (SELECT profiles.company_id FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.user_type = 'admin'));

-- RLS Policies for driver_earnings
CREATE POLICY "Drivers can view their own earnings" 
ON public.driver_earnings 
FOR SELECT 
USING (driver_id IN (SELECT dp.id FROM driver_profiles dp WHERE dp.user_id = auth.uid()));

CREATE POLICY "Admins can manage earnings in their company" 
ON public.driver_earnings 
FOR ALL 
USING (company_id IN (SELECT profiles.company_id FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.user_type = 'admin'))
WITH CHECK (company_id IN (SELECT profiles.company_id FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.user_type = 'admin'));

-- Add triggers for updated_at columns
CREATE TRIGGER update_route_feedback_updated_at
BEFORE UPDATE ON public.route_feedback
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_driver_expenses_updated_at
BEFORE UPDATE ON public.driver_expenses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_driver_earnings_updated_at
BEFORE UPDATE ON public.driver_earnings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_route_feedback_driver_id ON public.route_feedback(driver_id);
CREATE INDEX idx_route_feedback_date ON public.route_feedback(feedback_date);
CREATE INDEX idx_driver_achievements_driver_id ON public.driver_achievements(driver_id);
CREATE INDEX idx_driver_achievements_type ON public.driver_achievements(achievement_type);
CREATE INDEX idx_driver_expenses_driver_id ON public.driver_expenses(driver_id);
CREATE INDEX idx_driver_expenses_date ON public.driver_expenses(expense_date);
CREATE INDEX idx_driver_earnings_driver_id ON public.driver_earnings(driver_id);
CREATE INDEX idx_driver_earnings_date ON public.driver_earnings(earning_date);