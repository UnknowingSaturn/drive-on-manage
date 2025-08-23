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