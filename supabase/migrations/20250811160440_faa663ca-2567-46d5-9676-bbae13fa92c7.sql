-- First, fix the invalid company_id in profiles
UPDATE profiles 
SET company_id = 'b9c484a1-7857-4f44-8d42-2c4740504464' 
WHERE company_id = '7ca55934-3393-4613-937b-3882f76813ec';

-- Create user_companies junction table
CREATE TABLE public.user_companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, company_id)
);

-- Enable RLS on user_companies
ALTER TABLE public.user_companies ENABLE ROW LEVEL SECURITY;

-- Create policies for user_companies
CREATE POLICY "Users can view their own company associations" 
ON public.user_companies 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Users can manage their own company associations" 
ON public.user_companies 
FOR ALL 
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Create function to check if user has role in company
CREATE OR REPLACE FUNCTION public.user_has_company_role(user_id_param UUID, company_id_param UUID, role_param TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF role_param IS NULL THEN
    -- Check if user has any role in the company
    RETURN EXISTS (
      SELECT 1 FROM user_companies 
      WHERE user_id = user_id_param 
      AND company_id = company_id_param
    );
  ELSE
    -- Check if user has specific role in the company
    RETURN EXISTS (
      SELECT 1 FROM user_companies 
      WHERE user_id = user_id_param 
      AND company_id = company_id_param 
      AND role = role_param
    );
  END IF;
END;
$$;

-- Migrate existing company_id data from profiles to user_companies
INSERT INTO public.user_companies (user_id, company_id, role)
SELECT user_id, company_id, 
  CASE 
    WHEN user_type = 'admin' THEN 'admin'
    ELSE 'member'
  END as role
FROM profiles 
WHERE company_id IS NOT NULL;

-- Now drop all policies that depend on profiles.company_id and recreate them

-- Drop and recreate all RLS policies that reference profiles.company_id
DROP POLICY IF EXISTS "Admins can view drivers in their company" ON public.driver_profiles;
DROP POLICY IF EXISTS "Admins can view rounds in their company" ON public.rounds;
DROP POLICY IF EXISTS "Admins can insert rounds in their company" ON public.rounds;
DROP POLICY IF EXISTS "Admins can update rounds in their company" ON public.rounds;
DROP POLICY IF EXISTS "Admins can delete rounds in their company" ON public.rounds;
DROP POLICY IF EXISTS "Company users can view vans" ON public.vans;
DROP POLICY IF EXISTS "Admins can insert vans" ON public.vans;
DROP POLICY IF EXISTS "Admins can update vans" ON public.vans;
DROP POLICY IF EXISTS "Admins can delete vans" ON public.vans;
DROP POLICY IF EXISTS "Admins can update driver profiles" ON public.driver_profiles;
DROP POLICY IF EXISTS "Admins can view logs in their company" ON public.daily_logs;
DROP POLICY IF EXISTS "Admins can view vehicle checks in their company" ON public.vehicle_checks;
DROP POLICY IF EXISTS "Admins can view incident reports in their company" ON public.incident_reports;
DROP POLICY IF EXISTS "Admins can update incident reports" ON public.incident_reports;
DROP POLICY IF EXISTS "Company users can view announcements" ON public.announcements;
DROP POLICY IF EXISTS "Admins can insert announcements" ON public.announcements;
DROP POLICY IF EXISTS "Admins can update announcements" ON public.announcements;
DROP POLICY IF EXISTS "Admins can delete announcements" ON public.announcements;
DROP POLICY IF EXISTS "Admins can view SOD logs in their company" ON public.sod_logs;
DROP POLICY IF EXISTS "Admins can view EOD reports in their company" ON public.eod_reports;
DROP POLICY IF EXISTS "Admins can update EOD reports in their company" ON public.eod_reports;
DROP POLICY IF EXISTS "Admins can manage schedules in their company" ON public.schedules;
DROP POLICY IF EXISTS "Admins can manage payments in their company" ON public.payments;
DROP POLICY IF EXISTS "Admins can update their company" ON public.companies;
DROP POLICY IF EXISTS "Admins can manage invoices in their company" ON public.driver_invoices;
DROP POLICY IF EXISTS "Admins can manage operating costs in their company" ON public.operating_costs;
DROP POLICY IF EXISTS "Admins can view feedback in their company" ON public.route_feedback;
DROP POLICY IF EXISTS "Admins can manage achievements in their company" ON public.driver_achievements;
DROP POLICY IF EXISTS "Admins can manage expenses in their company" ON public.driver_expenses;
DROP POLICY IF EXISTS "Admins can manage earnings in their company" ON public.driver_earnings;
DROP POLICY IF EXISTS "Drivers can view their own logs" ON public.daily_logs;
DROP POLICY IF EXISTS "Company users can view messages in their company" ON public.messages;
DROP POLICY IF EXISTS "Company users can insert messages in their company" ON public.messages;
DROP POLICY IF EXISTS "Admins can delete messages in their company" ON public.messages;
DROP POLICY IF EXISTS "Admins can manage their company settings" ON public.company_settings;
DROP POLICY IF EXISTS "Admins can manage driver ratings in their company" ON public.driver_ratings;
DROP POLICY IF EXISTS "Admins can create driver profiles for their company" ON public.profiles;
DROP POLICY IF EXISTS "Admins can insert driver profiles for their company" ON public.driver_profiles;
DROP POLICY IF EXISTS "Admins can create driver profiles" ON public.profiles;

-- Remove company_id from profiles table
ALTER TABLE public.profiles DROP COLUMN company_id;