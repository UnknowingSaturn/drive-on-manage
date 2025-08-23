-- Final RLS Policy Optimization: Merge remaining multiple permissive policies

-- =====================================================================
-- PROFILES TABLE: Merge multiple INSERT and SELECT policies
-- =====================================================================

-- Drop existing INSERT policies
DROP POLICY IF EXISTS "Admins can create admin profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can create driver profiles for their companies" ON public.profiles;
DROP POLICY IF EXISTS "Service role can create profiles" ON public.profiles;

-- Create consolidated INSERT policy
CREATE POLICY "Users can insert profiles" ON public.profiles
FOR INSERT 
WITH CHECK (
  -- Users can create their own admin profile
  ((user_id = (SELECT auth.uid())) AND (user_type = 'admin')) 
  OR 
  -- Admins can create driver profiles for their companies
  ((user_type = 'driver') AND (EXISTS (
    SELECT 1 FROM user_companies uc 
    WHERE uc.user_id = (SELECT auth.uid()) AND uc.role = 'admin'
  ))) 
  OR 
  -- Service role can create any profile
  ((SELECT auth.role()) = 'service_role')
);

-- Drop existing SELECT policies  
DROP POLICY IF EXISTS "Admins can view driver profiles in their companies" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Create consolidated SELECT policy
CREATE POLICY "Users can view profiles" ON public.profiles
FOR SELECT 
USING (
  -- Users can view their own profile
  (user_id = (SELECT auth.uid())) 
  OR 
  -- Admins can view driver profiles in their companies
  ((user_type = 'driver') AND (EXISTS (
    SELECT 1 FROM user_companies uc1, user_companies uc2
    WHERE uc1.user_id = (SELECT auth.uid()) 
    AND uc1.role = 'admin' 
    AND uc2.user_id = profiles.user_id 
    AND uc1.company_id = uc2.company_id
  )))
);

-- =====================================================================
-- ROUNDS TABLE: Merge multiple SELECT policies
-- =====================================================================

-- Drop existing SELECT policies
DROP POLICY IF EXISTS "Admins can manage rounds in their companies" ON public.rounds;
DROP POLICY IF EXISTS "Drivers can view rounds they are scheduled for" ON public.rounds;

-- Create consolidated SELECT policy
CREATE POLICY "Users can view rounds" ON public.rounds
FOR SELECT 
USING (
  -- Admins can view rounds in their companies
  user_has_company_role((SELECT auth.uid()), company_id, 'admin') 
  OR 
  -- Drivers can view rounds they are scheduled for
  (id IN (
    SELECT s.round_id FROM schedules s 
    WHERE s.driver_id IN (
      SELECT dp.id FROM driver_profiles dp 
      WHERE dp.user_id = (SELECT auth.uid())
    )
  ))
);

-- Keep other CRUD policies for rounds (admins only)
CREATE POLICY "Admins can manage rounds in their companies" ON public.rounds
FOR ALL 
USING (user_has_company_role((SELECT auth.uid()), company_id, 'admin'))
WITH CHECK (user_has_company_role((SELECT auth.uid()), company_id, 'admin'));

-- =====================================================================
-- SCHEDULES TABLE: Merge multiple SELECT policies  
-- =====================================================================

-- Drop existing SELECT policies
DROP POLICY IF EXISTS "Admins can view schedules for their company" ON public.schedules;
DROP POLICY IF EXISTS "Drivers can view their own schedules" ON public.schedules;

-- Create consolidated SELECT policy
CREATE POLICY "Users can view schedules" ON public.schedules
FOR SELECT 
USING (
  -- Admins can view schedules for their company
  user_has_company_role((SELECT auth.uid()), company_id, 'admin') 
  OR 
  -- Drivers can view their own schedules
  (driver_id IN (
    SELECT dp.id FROM driver_profiles dp 
    WHERE dp.user_id = (SELECT auth.uid())
  ))
);

-- =====================================================================
-- START_OF_DAY_REPORTS TABLE: Merge multiple SELECT policies
-- =====================================================================

-- Drop existing SELECT policies
DROP POLICY IF EXISTS "Admins can view SOD reports in their companies" ON public.start_of_day_reports;
DROP POLICY IF EXISTS "Drivers can view their own SOD reports" ON public.start_of_day_reports;

-- Create consolidated SELECT policy  
CREATE POLICY "Users can view SOD reports" ON public.start_of_day_reports
FOR SELECT 
USING (
  -- Admins can view SOD reports in their companies
  (company_id IN (
    SELECT uc.company_id FROM user_companies uc 
    WHERE uc.user_id = (SELECT auth.uid()) AND uc.role = 'admin'
  )) 
  OR 
  -- Drivers can view their own SOD reports
  (driver_id IN (
    SELECT dp.id FROM driver_profiles dp 
    WHERE dp.user_id = (SELECT auth.uid())
  ))
);

-- =====================================================================
-- USER_COMPANIES TABLE: Merge multiple INSERT policies
-- =====================================================================

-- Drop existing INSERT policies
DROP POLICY IF EXISTS "Admins can create driver associations for their companies" ON public.user_companies;
DROP POLICY IF EXISTS "Service role can create user companies" ON public.user_companies;  
DROP POLICY IF EXISTS "Users can manage their own company associations" ON public.user_companies;

-- Create consolidated INSERT policy
CREATE POLICY "Users can insert user companies" ON public.user_companies
FOR INSERT 
WITH CHECK (
  -- Admins can create driver associations for their companies
  (EXISTS (
    SELECT 1 FROM user_companies uc 
    WHERE uc.user_id = (SELECT auth.uid()) 
    AND uc.company_id = user_companies.company_id 
    AND uc.role = 'admin'
  )) 
  OR 
  -- Service role can create any user company association
  ((SELECT auth.role()) = 'service_role') 
  OR 
  -- Users can manage their own company associations
  (user_id = (SELECT auth.uid()))
);

-- =====================================================================
-- VANS TABLE: Merge multiple SELECT policies
-- =====================================================================

-- Drop existing SELECT policies
DROP POLICY IF EXISTS "Admins can manage vans in their companies" ON public.vans;
DROP POLICY IF EXISTS "Users can view vans in their associated companies" ON public.vans;

-- Create consolidated SELECT policy
CREATE POLICY "Users can view vans" ON public.vans
FOR SELECT 
USING (
  -- Users can view vans in their associated companies
  company_id IN (
    SELECT uc.company_id FROM user_companies uc 
    WHERE uc.user_id = (SELECT auth.uid())
  )
);

-- Keep other CRUD policies for vans (admins only)  
CREATE POLICY "Admins can manage vans in their companies" ON public.vans
FOR INSERT 
WITH CHECK (user_has_company_role((SELECT auth.uid()), company_id, 'admin'));

CREATE POLICY "Admins can update vans in their companies" ON public.vans
FOR UPDATE 
USING (user_has_company_role((SELECT auth.uid()), company_id, 'admin'))
WITH CHECK (user_has_company_role((SELECT auth.uid()), company_id, 'admin'));

CREATE POLICY "Admins can delete vans in their companies" ON public.vans
FOR DELETE 
USING (user_has_company_role((SELECT auth.uid()), company_id, 'admin'));

-- =====================================================================
-- CLEANUP DUPLICATE INDEXES
-- =====================================================================

-- Drop duplicate index on driver_shifts (keep the more specific one)
DROP INDEX IF EXISTS idx_driver_shifts_driver_started_at;

-- Drop duplicate constraint on profiles (keep profiles_user_id_key)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_user_id_unique;