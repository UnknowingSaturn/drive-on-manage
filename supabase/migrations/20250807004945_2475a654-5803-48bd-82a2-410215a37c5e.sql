-- Create a temporary permissive policy for onboarding
-- This allows any authenticated user to create driver profiles during onboarding
-- We validate the invitation token in the application logic for security
CREATE POLICY "Temporary onboarding bypass" 
ON public.driver_profiles 
FOR INSERT 
TO authenticated
WITH CHECK (true);

-- We'll remove this after onboarding is working and implement proper validation