-- Add onboarding completion timestamp to driver_profiles
ALTER TABLE public.driver_profiles 
ADD COLUMN onboarding_completed_at TIMESTAMP WITH TIME ZONE;

-- Add emergency contact fields
ALTER TABLE public.driver_profiles 
ADD COLUMN emergency_contact_name TEXT,
ADD COLUMN emergency_contact_phone TEXT,
ADD COLUMN emergency_contact_relation TEXT,
ADD COLUMN vehicle_notes TEXT;

-- Create index for faster queries on onboarding status
CREATE INDEX idx_driver_profiles_onboarding_status 
ON public.driver_profiles (first_login_completed, onboarding_completed_at);

-- Update existing active drivers to have onboarding_completed_at if they don't have it
UPDATE public.driver_profiles 
SET onboarding_completed_at = updated_at 
WHERE first_login_completed = true 
AND onboarding_completed_at IS NULL;