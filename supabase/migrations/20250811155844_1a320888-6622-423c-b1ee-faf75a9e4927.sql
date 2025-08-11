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

-- Remove company_id from profiles table
ALTER TABLE public.profiles DROP COLUMN IF EXISTS company_id;

-- Update all RLS policies to use the new structure

-- Update profiles policies
DROP POLICY IF EXISTS "Admins can create driver profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can create driver profiles for their company" ON public.profiles;

CREATE POLICY "Admins can create driver profiles for their companies" 
ON public.profiles 
FOR INSERT 
WITH CHECK (
  user_type = 'driver' AND 
  EXISTS (
    SELECT 1 FROM user_companies uc
    WHERE uc.user_id = auth.uid() 
    AND uc.role = 'admin'
  )
);

-- Update driver_profiles policies
DROP POLICY IF EXISTS "Admins can insert driver profiles for their company" ON public.driver_profiles;
DROP POLICY IF EXISTS "Admins can update driver profiles" ON public.driver_profiles;
DROP POLICY IF EXISTS "Admins can view drivers in their company" ON public.driver_profiles;

CREATE POLICY "Admins can insert driver profiles for their companies" 
ON public.driver_profiles 
FOR INSERT 
WITH CHECK (
  public.user_has_company_role(auth.uid(), company_id, 'admin')
);

CREATE POLICY "Admins can update driver profiles in their companies" 
ON public.driver_profiles 
FOR UPDATE 
USING (
  public.user_has_company_role(auth.uid(), company_id, 'admin')
);

CREATE POLICY "Admins can view drivers in their companies" 
ON public.driver_profiles 
FOR SELECT 
USING (
  user_id = auth.uid() OR 
  public.user_has_company_role(auth.uid(), company_id, 'admin')
);

-- Update companies policies
DROP POLICY IF EXISTS "Admins can update their company" ON public.companies;
DROP POLICY IF EXISTS "Users can view companies they created" ON public.companies;

CREATE POLICY "Admins can update companies they manage" 
ON public.companies 
FOR UPDATE 
USING (
  public.user_has_company_role(auth.uid(), id, 'admin')
)
WITH CHECK (
  public.user_has_company_role(auth.uid(), id, 'admin')
);

CREATE POLICY "Users can view companies they belong to" 
ON public.companies 
FOR SELECT 
USING (
  created_by = auth.uid() OR 
  public.user_has_company_role(auth.uid(), id)
);

-- Update all other table policies that reference company_id
-- company_settings
DROP POLICY IF EXISTS "Admins can manage their company settings" ON public.company_settings;

CREATE POLICY "Admins can manage company settings for their companies" 
ON public.company_settings 
FOR ALL 
USING (
  public.user_has_company_role(auth.uid(), company_id, 'admin')
)
WITH CHECK (
  public.user_has_company_role(auth.uid(), company_id, 'admin')
);

-- daily_logs
DROP POLICY IF EXISTS "Admins can view logs in their company" ON public.daily_logs;

CREATE POLICY "Admins can view logs in their companies" 
ON public.daily_logs 
FOR SELECT 
USING (
  public.user_has_company_role(auth.uid(), company_id, 'admin') OR
  driver_id IN (SELECT dp.id FROM driver_profiles dp WHERE dp.user_id = auth.uid())
);

-- Continue with other tables...
-- eod_reports
DROP POLICY IF EXISTS "Admins can update EOD reports in their company" ON public.eod_reports;
DROP POLICY IF EXISTS "Admins can view EOD reports in their company" ON public.eod_reports;

CREATE POLICY "Admins can update EOD reports in their companies" 
ON public.eod_reports 
FOR UPDATE 
USING (
  public.user_has_company_role(auth.uid(), company_id, 'admin')
);

CREATE POLICY "Admins can view EOD reports in their companies" 
ON public.eod_reports 
FOR SELECT 
USING (
  public.user_has_company_role(auth.uid(), company_id, 'admin') OR
  driver_id IN (SELECT dp.id FROM driver_profiles dp WHERE dp.user_id = auth.uid())
);

-- Add updated_at trigger for user_companies
CREATE TRIGGER update_user_companies_updated_at
BEFORE UPDATE ON public.user_companies
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();