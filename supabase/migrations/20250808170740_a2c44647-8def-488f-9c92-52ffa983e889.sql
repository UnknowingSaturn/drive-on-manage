-- Create missing backend features for full functionality

-- 1. Chat/Messages table for real-time team communication
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT NOT NULL,
  sender_id UUID NOT NULL,
  sender_name TEXT NOT NULL,
  sender_role TEXT NOT NULL DEFAULT 'driver',
  company_id UUID NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'general', -- general, announcement, alert
  replied_to UUID REFERENCES public.messages(id),
  is_edited BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  CONSTRAINT chk_message_content_length CHECK (length(content) > 0 AND length(content) <= 2000),
  CONSTRAINT chk_sender_role_valid CHECK (sender_role IN ('admin', 'driver', 'system'))
);

-- Enable RLS for messages
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for messages
CREATE POLICY "Company users can view messages in their company" 
ON public.messages 
FOR SELECT 
USING (company_id IN (
  SELECT profiles.company_id 
  FROM profiles 
  WHERE profiles.user_id = auth.uid()
));

CREATE POLICY "Company users can insert messages in their company" 
ON public.messages 
FOR INSERT 
WITH CHECK (
  company_id IN (
    SELECT profiles.company_id 
    FROM profiles 
    WHERE profiles.user_id = auth.uid()
  ) AND
  sender_id = auth.uid()
);

CREATE POLICY "Users can update their own messages" 
ON public.messages 
FOR UPDATE 
USING (sender_id = auth.uid())
WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Admins can delete messages in their company" 
ON public.messages 
FOR DELETE 
USING (
  company_id IN (
    SELECT profiles.company_id 
    FROM profiles 
    WHERE profiles.user_id = auth.uid() AND profiles.user_type = 'admin'
  )
);

-- 2. Create settings table for admin configuration
CREATE TABLE IF NOT EXISTS public.company_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL UNIQUE,
  
  -- General settings
  default_parcel_rate NUMERIC DEFAULT 0.75,
  default_cover_rate NUMERIC DEFAULT 1.00,
  default_base_pay NUMERIC DEFAULT 10.00,
  
  -- Working hours and overtime
  standard_work_hours INTEGER DEFAULT 8,
  overtime_rate_multiplier NUMERIC DEFAULT 1.5,
  
  -- Notification settings
  email_notifications BOOLEAN DEFAULT true,
  sms_notifications BOOLEAN DEFAULT false,
  
  -- Document settings
  require_license_upload BOOLEAN DEFAULT true,
  require_insurance_upload BOOLEAN DEFAULT true,
  require_right_to_work BOOLEAN DEFAULT true,
  
  -- EOD/SOD settings
  require_vehicle_check BOOLEAN DEFAULT true,
  require_eod_screenshot BOOLEAN DEFAULT false,
  allow_late_submissions BOOLEAN DEFAULT true,
  late_submission_hours INTEGER DEFAULT 24,
  
  -- Financial settings
  payment_frequency TEXT DEFAULT 'weekly', -- weekly, biweekly, monthly
  payment_day INTEGER DEFAULT 5, -- Day of week (1=Monday, 7=Sunday) or day of month
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  CONSTRAINT chk_valid_payment_frequency CHECK (payment_frequency IN ('weekly', 'biweekly', 'monthly')),
  CONSTRAINT chk_valid_payment_day CHECK (payment_day >= 1 AND payment_day <= 31),
  CONSTRAINT chk_positive_rates CHECK (
    default_parcel_rate >= 0 AND 
    default_cover_rate >= 0 AND 
    default_base_pay >= 0 AND
    overtime_rate_multiplier >= 1.0
  )
);

-- Enable RLS for company settings
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for company settings
CREATE POLICY "Admins can manage their company settings" 
ON public.company_settings 
FOR ALL 
USING (company_id IN (
  SELECT profiles.company_id 
  FROM profiles 
  WHERE profiles.user_id = auth.uid() AND profiles.user_type = 'admin'
))
WITH CHECK (company_id IN (
  SELECT profiles.company_id 
  FROM profiles 
  WHERE profiles.user_id = auth.uid() AND profiles.user_type = 'admin'
));

-- 3. Create driver ratings/reviews table for performance tracking
CREATE TABLE IF NOT EXISTS public.driver_ratings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL,
  rated_by UUID NOT NULL,
  company_id UUID NOT NULL,
  
  -- Rating categories (1-5 scale)
  punctuality INTEGER NOT NULL DEFAULT 5,
  communication INTEGER NOT NULL DEFAULT 5,
  vehicle_care INTEGER NOT NULL DEFAULT 5,
  customer_service INTEGER NOT NULL DEFAULT 5,
  overall_rating NUMERIC NOT NULL DEFAULT 5.0,
  
  -- Feedback
  feedback_text TEXT,
  is_anonymous BOOLEAN NOT NULL DEFAULT false,
  
  -- Period this rating covers
  rating_period_start DATE NOT NULL,
  rating_period_end DATE NOT NULL,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  CONSTRAINT chk_valid_ratings CHECK (
    punctuality >= 1 AND punctuality <= 5 AND
    communication >= 1 AND communication <= 5 AND
    vehicle_care >= 1 AND vehicle_care <= 5 AND
    customer_service >= 1 AND customer_service <= 5 AND
    overall_rating >= 1.0 AND overall_rating <= 5.0
  ),
  CONSTRAINT chk_valid_period CHECK (rating_period_end >= rating_period_start)
);

-- Enable RLS for driver ratings
ALTER TABLE public.driver_ratings ENABLE ROW LEVEL SECURITY;

-- RLS policies for driver ratings
CREATE POLICY "Admins can manage driver ratings in their company" 
ON public.driver_ratings 
FOR ALL 
USING (company_id IN (
  SELECT profiles.company_id 
  FROM profiles 
  WHERE profiles.user_id = auth.uid() AND profiles.user_type = 'admin'
));

CREATE POLICY "Drivers can view their own ratings" 
ON public.driver_ratings 
FOR SELECT 
USING (driver_id IN (
  SELECT dp.id 
  FROM driver_profiles dp 
  WHERE dp.user_id = auth.uid()
));

-- Add indexes for performance
CREATE INDEX idx_messages_company_created ON public.messages(company_id, created_at);
CREATE INDEX idx_messages_sender ON public.messages(sender_id);
CREATE INDEX idx_company_settings_company ON public.company_settings(company_id);
CREATE INDEX idx_driver_ratings_driver ON public.driver_ratings(driver_id);
CREATE INDEX idx_driver_ratings_company ON public.driver_ratings(company_id);

-- Add update triggers
CREATE TRIGGER update_messages_updated_at 
  BEFORE UPDATE ON public.messages 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_company_settings_updated_at 
  BEFORE UPDATE ON public.company_settings 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();