-- Add RLS policy to allow drivers to insert their own profile during onboarding
CREATE POLICY "Drivers can insert their own profile during onboarding" 
ON public.driver_profiles 
FOR INSERT 
WITH CHECK (user_id = auth.uid());