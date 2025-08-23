-- Fix Remaining RLS Performance Issues - Phase 2
-- Address all remaining auth function per-row evaluations and merge multiple permissive policies

-- 1. Fix remaining tables with auth function per-row evaluations

-- Fix VANS table policies (missing from previous optimization)
DROP POLICY IF EXISTS "Admins can manage vans in their companies" ON vans;
DROP POLICY IF EXISTS "Users can view vans in their associated companies" ON vans;

CREATE POLICY "Admins can manage vans in their companies" 
ON vans FOR ALL 
USING (company_id IN ( 
  SELECT uc.company_id FROM user_companies uc
  WHERE ((uc.user_id = (SELECT auth.uid())) AND (uc.role = 'admin'::text))
))
WITH CHECK (company_id IN ( 
  SELECT uc.company_id FROM user_companies uc
  WHERE ((uc.user_id = (SELECT auth.uid())) AND (uc.role = 'admin'::text))
));

CREATE POLICY "Users can view vans in their associated companies" 
ON vans FOR SELECT 
USING (company_id IN ( 
  SELECT uc.company_id FROM user_companies uc
  WHERE (uc.user_id = (SELECT auth.uid()))
));

-- Fix VEHICLE_CHECKS table policies
DROP POLICY IF EXISTS "Drivers can insert their own vehicle checks" ON vehicle_checks;
DROP POLICY IF EXISTS "Drivers can view their own vehicle checks" ON vehicle_checks;

CREATE POLICY "Drivers can manage their own vehicle checks" 
ON vehicle_checks FOR ALL 
USING (driver_id IN ( 
  SELECT dp.id FROM driver_profiles dp
  WHERE (dp.user_id = (SELECT auth.uid()))
))
WITH CHECK (driver_id IN ( 
  SELECT dp.id FROM driver_profiles dp
  WHERE (dp.user_id = (SELECT auth.uid()))
));

-- Fix USER_COMPANIES policy for performance
DROP POLICY IF EXISTS "Users can view their own company associations" ON user_companies;
DROP POLICY IF EXISTS "Users can manage their own company associations" ON user_companies;

CREATE POLICY "Users can manage their own company associations" 
ON user_companies FOR ALL 
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));