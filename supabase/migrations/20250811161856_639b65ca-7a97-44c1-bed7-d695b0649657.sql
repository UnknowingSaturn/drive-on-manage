-- Update companies policies to be more restrictive
DROP POLICY IF EXISTS "Users can view companies they belong to" ON public.companies;

CREATE POLICY "Users can view companies they created or belong to" 
ON public.companies 
FOR SELECT 
USING (
  created_by = auth.uid() OR 
  id IN (
    SELECT company_id 
    FROM user_companies 
    WHERE user_id = auth.uid()
  )
);

-- Also update the companies insert policy to be more explicit
DROP POLICY IF EXISTS "Admins can insert companies" ON public.companies;

CREATE POLICY "Authenticated users can create companies" 
ON public.companies 
FOR INSERT 
WITH CHECK (
  created_by = auth.uid()
);

-- Update other table policies to be more restrictive based on user's company associations
DROP POLICY IF EXISTS "Admins can view drivers in their companies" ON public.driver_profiles;

CREATE POLICY "Admins can view drivers in their associated companies" 
ON public.driver_profiles 
FOR SELECT 
USING (
  user_id = auth.uid() OR 
  company_id IN (
    SELECT company_id 
    FROM user_companies 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- Update EOD reports policy 
DROP POLICY IF EXISTS "Admins can view EOD reports in their companies" ON public.eod_reports;

CREATE POLICY "Admins can view EOD reports in their associated companies" 
ON public.eod_reports 
FOR SELECT 
USING (
  company_id IN (
    SELECT company_id 
    FROM user_companies 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  ) OR
  driver_id IN (SELECT dp.id FROM driver_profiles dp WHERE dp.user_id = auth.uid())
);

-- Update vans policy
DROP POLICY IF EXISTS "Company users can view vans in their companies" ON public.vans;

CREATE POLICY "Users can view vans in their associated companies" 
ON public.vans 
FOR SELECT 
USING (
  company_id IN (
    SELECT company_id 
    FROM user_companies 
    WHERE user_id = auth.uid()
  )
);