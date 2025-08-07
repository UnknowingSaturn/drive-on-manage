-- Drop the current policy that's too restrictive
DROP POLICY "Drivers can insert their own profile during onboarding" ON public.driver_profiles;

-- Create a better policy that allows insertion during onboarding with proper company validation
CREATE POLICY "Users can insert driver profile during onboarding" 
ON public.driver_profiles 
FOR INSERT 
WITH CHECK (
  user_id = auth.uid() AND 
  company_id IN (
    SELECT company_id 
    FROM driver_invitations 
    WHERE email = auth.email() AND status = 'pending'
  )
);