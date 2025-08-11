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

-- Remove company_id from profiles table
ALTER TABLE public.profiles DROP COLUMN IF EXISTS company_id;