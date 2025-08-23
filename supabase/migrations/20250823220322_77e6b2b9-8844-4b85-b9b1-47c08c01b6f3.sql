-- Fix Multiple Permissive Policies Issue - Merge into Single OR-based Policies
-- This significantly improves performance by eliminating multiple policy evaluations

-- 2. Merge Multiple Permissive Policies - DRIVER_INVOICES
DROP POLICY IF EXISTS "Admins can view invoices for their company" ON driver_invoices;
DROP POLICY IF EXISTS "Drivers can view their own invoices" ON driver_invoices;

CREATE POLICY "Users can view driver invoices" 
ON driver_invoices FOR SELECT 
USING (
  -- Drivers can view their own invoices
  (driver_id IN ( 
    SELECT driver_profiles.id FROM driver_profiles
    WHERE (driver_profiles.user_id = (SELECT auth.uid()))
  )) OR
  -- Admins can view all invoices in their companies
  (company_id IN ( 
    SELECT uc.company_id FROM user_companies uc
    WHERE ((uc.user_id = (SELECT auth.uid())) AND (uc.role = 'admin'::text))
  ))
);

-- 3. Merge Multiple Permissive Policies - DRIVER_PROFILES
DROP POLICY IF EXISTS "Drivers can view and update only their own profile" ON driver_profiles;
DROP POLICY IF EXISTS "Admins can view all driver profiles in their companies" ON driver_profiles;
DROP POLICY IF EXISTS "Admins can insert driver profiles for their companies" ON driver_profiles;
DROP POLICY IF EXISTS "Admins can update driver profiles in their companies" ON driver_profiles;

-- Single SELECT policy for driver profiles
CREATE POLICY "Users can view driver profiles" 
ON driver_profiles FOR SELECT 
USING (
  -- Drivers can view their own profile
  (user_id = (SELECT auth.uid())) OR
  -- Admins can view all profiles in their companies
  (company_id IN ( 
    SELECT uc.company_id FROM user_companies uc
    WHERE ((uc.user_id = (SELECT auth.uid())) AND (uc.role = 'admin'::text))
  ))
);

-- Single INSERT policy for driver profiles
CREATE POLICY "Users can insert driver profiles" 
ON driver_profiles FOR INSERT 
WITH CHECK (
  -- Drivers can insert their own profile
  (user_id = (SELECT auth.uid())) OR
  -- Admins can insert profiles for their companies
  (company_id IN ( 
    SELECT uc.company_id FROM user_companies uc
    WHERE ((uc.user_id = (SELECT auth.uid())) AND (uc.role = 'admin'::text))
  ))
);

-- Single UPDATE policy for driver profiles
CREATE POLICY "Users can update driver profiles" 
ON driver_profiles FOR UPDATE 
USING (
  -- Drivers can update their own profile
  (user_id = (SELECT auth.uid())) OR
  -- Admins can update profiles in their companies
  (company_id IN ( 
    SELECT uc.company_id FROM user_companies uc
    WHERE ((uc.user_id = (SELECT auth.uid())) AND (uc.role = 'admin'::text))
  ))
)
WITH CHECK (
  -- Same conditions for WITH CHECK
  (user_id = (SELECT auth.uid())) OR
  (company_id IN ( 
    SELECT uc.company_id FROM user_companies uc
    WHERE ((uc.user_id = (SELECT auth.uid())) AND (uc.role = 'admin'::text))
  ))
);