-- Comprehensive Supabase Advisor Optimization and Security Fixes
-- This migration addresses all linter warnings and security recommendations

-- 1. Fix Function Search Path Mutable Issues
-- Update all functions to have proper search_path set for security

-- Fix update_updated_at_column function
DROP FUNCTION IF EXISTS public.update_updated_at_column();
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix update_shift_updated_at function  
DROP FUNCTION IF EXISTS public.update_shift_updated_at();
CREATE OR REPLACE FUNCTION public.update_shift_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix calculate_eod_total_parcels function
DROP FUNCTION IF EXISTS public.calculate_eod_total_parcels();
CREATE OR REPLACE FUNCTION public.calculate_eod_total_parcels()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.total_parcels = COALESCE(NEW.successful_deliveries, 0) + COALESCE(NEW.successful_collections, 0);
  RETURN NEW;
END;
$$;

-- Fix set_driver_password function
DROP FUNCTION IF EXISTS public.set_driver_password(text, text);
CREATE OR REPLACE FUNCTION public.set_driver_password(user_email text, new_password text)
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Update the user's password in auth.users
  UPDATE auth.users 
  SET encrypted_password = crypt(new_password, gen_salt('bf'))
  WHERE email = user_email;
END;
$$;

-- 2. Fix Critical RLS Policy Issues for Security

-- Fix MESSAGES table - Add proper RLS policies for message access
DROP POLICY IF EXISTS "Users can view messages in their companies" ON messages;
DROP POLICY IF EXISTS "Users can create messages in their companies" ON messages;
DROP POLICY IF EXISTS "Drivers can view company messages" ON messages;
DROP POLICY IF EXISTS "Management can view all company messages" ON messages;

-- Messages: Users can only see messages in their company and relevant to them
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

-- Fix DRIVER_PROFILES table - Strengthen protection of sensitive data
-- Drop existing policies that may be too permissive
DROP POLICY IF EXISTS "Admins can view drivers in their associated companies" ON driver_profiles;
DROP POLICY IF EXISTS "Drivers can manage their own profile" ON driver_profiles;

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

-- Fix PAYMENTS table - Restrict financial data access
DROP POLICY IF EXISTS "Drivers can view their own payments" ON payments;
DROP POLICY IF EXISTS "Admins can view company payments" ON payments;
DROP POLICY IF EXISTS "Management can view payments" ON payments;

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

-- 3. Add Performance Indexes for Common Queries

-- Index on user_companies for frequent role/company lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_companies_user_role 
ON user_companies(user_id, company_id, role);

-- Index on driver_profiles for user_id lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_driver_profiles_user_id 
ON driver_profiles(user_id);

-- Index on driver_profiles for company_id lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_driver_profiles_company_id 
ON driver_profiles(company_id);

-- Index on location_points for driver and timestamp queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_location_points_driver_timestamp 
ON location_points(driver_id, timestamp DESC);

-- Index on location_points for company and timestamp queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_location_points_company_timestamp 
ON location_points(company_id, timestamp DESC);

-- Index on end_of_day_reports for driver and date queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_eod_reports_driver_date 
ON end_of_day_reports(driver_id, created_at DESC);

-- Index on start_of_day_reports for driver and date queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sod_reports_driver_date 
ON start_of_day_reports(driver_id, created_at DESC);

-- Index on payments for driver and period queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_driver_period 
ON payments(driver_id, period_start, period_end);

-- Index on driver_shifts for driver and date queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_driver_shifts_driver_date 
ON driver_shifts(driver_id, start_time DESC);

-- Index on messages for company and timestamp
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_company_timestamp 
ON messages(company_id, created_at DESC);

-- 4. Add Foreign Key Constraints for Data Integrity

-- Add foreign key constraints where missing
ALTER TABLE driver_profiles 
ADD CONSTRAINT fk_driver_profiles_company_id 
FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE user_companies 
ADD CONSTRAINT fk_user_companies_company_id 
FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE end_of_day_reports 
ADD CONSTRAINT fk_eod_reports_driver_id 
FOREIGN KEY (driver_id) REFERENCES driver_profiles(id) ON DELETE CASCADE;

ALTER TABLE start_of_day_reports 
ADD CONSTRAINT fk_sod_reports_driver_id 
FOREIGN KEY (driver_id) REFERENCES driver_profiles(id) ON DELETE CASCADE;

ALTER TABLE location_points 
ADD CONSTRAINT fk_location_points_driver_id 
FOREIGN KEY (driver_id) REFERENCES driver_profiles(id) ON DELETE CASCADE;

ALTER TABLE driver_shifts 
ADD CONSTRAINT fk_driver_shifts_driver_id 
FOREIGN KEY (driver_id) REFERENCES driver_profiles(id) ON DELETE CASCADE;

ALTER TABLE payments 
ADD CONSTRAINT fk_payments_driver_id 
FOREIGN KEY (driver_id) REFERENCES driver_profiles(id) ON DELETE CASCADE;

ALTER TABLE driver_expenses 
ADD CONSTRAINT fk_driver_expenses_driver_id 
FOREIGN KEY (driver_id) REFERENCES driver_profiles(id) ON DELETE CASCADE;

ALTER TABLE driver_invoices 
ADD CONSTRAINT fk_driver_invoices_driver_id 
FOREIGN KEY (driver_id) REFERENCES driver_profiles(id) ON DELETE CASCADE;

-- 5. Clean Up and Optimize Table Structure

-- Add NOT NULL constraints where appropriate for data integrity
ALTER TABLE profiles ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE driver_profiles ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE driver_profiles ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE user_companies ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE user_companies ALTER COLUMN company_id SET NOT NULL;

-- Add check constraints for data validation
ALTER TABLE driver_ratings 
ADD CONSTRAINT chk_driver_ratings_valid_scores 
CHECK (
  overall_rating >= 1.0 AND overall_rating <= 5.0 AND
  punctuality >= 1 AND punctuality <= 5 AND
  communication >= 1 AND communication <= 5 AND
  customer_service >= 1 AND customer_service <= 5 AND
  vehicle_care >= 1 AND vehicle_care <= 5
);

ALTER TABLE route_feedback 
ADD CONSTRAINT chk_route_feedback_valid_ratings 
CHECK (
  (route_difficulty IS NULL OR (route_difficulty >= 1 AND route_difficulty <= 5)) AND
  (traffic_rating IS NULL OR (traffic_rating >= 1 AND traffic_rating <= 5)) AND
  (depot_experience IS NULL OR (depot_experience >= 1 AND depot_experience <= 5))
);

-- Add check constraints for financial data
ALTER TABLE payments 
ADD CONSTRAINT chk_payments_positive_amounts 
CHECK (
  total_pay >= 0 AND
  parcel_count >= 0 AND
  parcel_rate >= 0 AND
  (base_pay IS NULL OR base_pay >= 0)
);

ALTER TABLE driver_expenses 
ADD CONSTRAINT chk_driver_expenses_positive_amount 
CHECK (amount >= 0);

ALTER TABLE operating_costs 
ADD CONSTRAINT chk_operating_costs_positive_amount 
CHECK (amount >= 0);

-- 6. Merge Duplicate/Similar Policies
-- Most policies were already consolidated in the previous optimization

-- 7. Add Proper Cascading and Referential Integrity
-- Already handled above in foreign key constraints section

COMMENT ON MIGRATION IS 'Comprehensive Supabase Advisor optimization: Fixed function search paths, strengthened RLS policies for security, added performance indexes, improved data integrity with foreign keys and constraints, and optimized table structure for better performance and maintainability.';