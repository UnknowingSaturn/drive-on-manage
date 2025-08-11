-- Clean up old driver invitation system

-- Drop the old driver onboarding tables and related data
DROP TABLE IF EXISTS driver_invitations CASCADE;
DROP TABLE IF EXISTS invitation_audit_log CASCADE; 
DROP TABLE IF EXISTS invitation_rate_limits CASCADE;

-- Update driver_profiles table to remove invitation-related columns
ALTER TABLE driver_profiles 
DROP COLUMN IF EXISTS employee_id,
DROP COLUMN IF EXISTS onboarding_progress,
DROP COLUMN IF EXISTS onboarding_completed_at;

-- Add columns for direct admin creation flow
ALTER TABLE driver_profiles 
ADD COLUMN IF NOT EXISTS first_login_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS requires_onboarding BOOLEAN DEFAULT TRUE;

-- Remove old RLS policies that reference driver_invitations
DROP POLICY IF EXISTS "Driver profiles require valid invitation" ON driver_profiles;
DROP POLICY IF EXISTS "Drivers can create profiles via invitation" ON profiles;

-- Update RLS policies for the new admin-created flow
CREATE POLICY "Admins can create driver profiles directly" 
ON driver_profiles 
FOR INSERT 
WITH CHECK (
  company_id IN (
    SELECT p.company_id 
    FROM profiles p 
    WHERE p.user_id = auth.uid() 
    AND p.user_type = 'admin'
  )
);

-- Update profiles policy to allow driver profile creation by admins
CREATE POLICY "Admins can create driver profiles for their company" 
ON profiles 
FOR INSERT 
WITH CHECK (
  user_type = 'driver' AND
  company_id IN (
    SELECT p.company_id 
    FROM profiles p 
    WHERE p.user_id = auth.uid() 
    AND p.user_type = 'admin'
  )
);