-- Remove the foreign key constraint temporarily for onboarding
-- We'll add proper validation later through application logic
ALTER TABLE public.driver_profiles 
DROP CONSTRAINT IF EXISTS driver_profiles_user_id_fkey;

-- Add a simple check that user_id is not null
ALTER TABLE public.driver_profiles 
ADD CONSTRAINT driver_profiles_user_id_not_null 
CHECK (user_id IS NOT NULL);