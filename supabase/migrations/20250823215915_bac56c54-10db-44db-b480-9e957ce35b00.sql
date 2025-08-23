-- Continue Security and Performance Optimization
-- Fix Critical RLS Policy Issues and Add Performance Indexes

-- 1. Fix MESSAGES table - Add proper RLS policies for message access
DROP POLICY IF EXISTS "Users can update their own messages" ON messages;
DROP POLICY IF EXISTS "Users can view messages in their companies" ON messages;
DROP POLICY IF EXISTS "Users can create messages in their companies" ON messages;

-- Messages: Users can only see messages in their company
CREATE POLICY "Users can view messages in their companies" 
ON messages FOR SELECT 
USING (company_id IN ( 
  SELECT uc.company_id FROM user_companies uc
  WHERE (uc.user_id = (SELECT auth.uid()))
));

CREATE POLICY "Users can create messages in their companies" 
ON messages FOR INSERT 
WITH CHECK (
  (sender_id = (SELECT auth.uid())) AND 
  (company_id IN ( 
    SELECT uc.company_id FROM user_companies uc
    WHERE (uc.user_id = (SELECT auth.uid()))
  ))
);

CREATE POLICY "Users can update their own messages" 
ON messages FOR UPDATE 
USING (sender_id = (SELECT auth.uid()))
WITH CHECK (sender_id = (SELECT auth.uid()));

-- 2. Strengthen DRIVER_PROFILES table protection of sensitive data
DROP POLICY IF EXISTS "Admins can view drivers in their associated companies" ON driver_profiles;
DROP POLICY IF EXISTS "Drivers can manage their own profile" ON driver_profiles;
DROP POLICY IF EXISTS "Admins can insert driver profiles for their companies" ON driver_profiles;
DROP POLICY IF EXISTS "Admins can update driver profiles in their companies" ON driver_profiles;

-- Recreate with stricter access controls
CREATE POLICY "Drivers can view and update only their own profile" 
ON driver_profiles FOR ALL 
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Admins can view all driver profiles in their companies" 
ON driver_profiles FOR SELECT 
USING (company_id IN ( 
  SELECT uc.company_id FROM user_companies uc
  WHERE ((uc.user_id = (SELECT auth.uid())) AND (uc.role = 'admin'::text))
));

CREATE POLICY "Admins can insert driver profiles for their companies" 
ON driver_profiles FOR INSERT 
WITH CHECK (company_id IN ( 
  SELECT uc.company_id FROM user_companies uc
  WHERE ((uc.user_id = (SELECT auth.uid())) AND (uc.role = 'admin'::text))
));

CREATE POLICY "Admins can update driver profiles in their companies" 
ON driver_profiles FOR UPDATE 
USING (company_id IN ( 
  SELECT uc.company_id FROM user_companies uc
  WHERE ((uc.user_id = (SELECT auth.uid())) AND (uc.role = 'admin'::text))
))
WITH CHECK (company_id IN ( 
  SELECT uc.company_id FROM user_companies uc
  WHERE ((uc.user_id = (SELECT auth.uid())) AND (uc.role = 'admin'::text))
));

-- 3. Fix PAYMENTS table - Restrict financial data access more strictly
DROP POLICY IF EXISTS "Drivers can view their own payments" ON payments;
DROP POLICY IF EXISTS "Drivers can view only their own payments" ON payments;
DROP POLICY IF EXISTS "Admins can view all payments in their companies" ON payments;

-- Only drivers can see their own payments, only admins can see all company payments
CREATE POLICY "Drivers can view only their own payments" 
ON payments FOR SELECT 
USING (driver_id IN ( 
  SELECT driver_profiles.id FROM driver_profiles
  WHERE (driver_profiles.user_id = (SELECT auth.uid()))
));

CREATE POLICY "Admins can view all payments in their companies" 
ON payments FOR SELECT 
USING (company_id IN ( 
  SELECT uc.company_id FROM user_companies uc
  WHERE ((uc.user_id = (SELECT auth.uid())) AND (uc.role = 'admin'::text))
));