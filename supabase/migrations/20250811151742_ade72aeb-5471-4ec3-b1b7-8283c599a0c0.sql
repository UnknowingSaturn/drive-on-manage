-- Fix driver_profiles status constraint to include all valid status values
ALTER TABLE driver_profiles DROP CONSTRAINT IF EXISTS driver_profiles_status_check;

-- Add the updated constraint with all valid status values
ALTER TABLE driver_profiles ADD CONSTRAINT driver_profiles_status_check 
CHECK (status = ANY (ARRAY['pending', 'active', 'inactive', 'suspended', 'pending_onboarding', 'onboarding_complete']::text[]));