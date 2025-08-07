-- Temporarily create a very permissive policy for debugging
DROP POLICY "Allow driver profile creation during onboarding" ON public.driver_profiles;

-- Create a simple policy that allows any authenticated user to insert their own profile
-- This is temporary for debugging - we'll make it more restrictive once it works
CREATE POLICY "Temporary permissive driver profile creation" 
ON public.driver_profiles 
FOR INSERT 
WITH CHECK (user_id = auth.uid());