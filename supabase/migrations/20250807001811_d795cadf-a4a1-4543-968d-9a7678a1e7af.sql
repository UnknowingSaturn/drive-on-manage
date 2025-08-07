-- Drop the current policy and fix the auth.users access issue
DROP POLICY "Allow driver profile creation during onboarding" ON public.driver_profiles;

-- Create a corrected policy using auth.email() instead of querying auth.users
CREATE POLICY "Allow driver profile creation during onboarding" 
ON public.driver_profiles 
FOR INSERT 
WITH CHECK (
  user_id = auth.uid() AND 
  (
    -- Allow if user is admin in the company
    company_id IN (
      SELECT p.company_id 
      FROM profiles p 
      WHERE p.user_id = auth.uid() AND p.user_type = 'admin'
    )
    OR
    -- Allow during onboarding - check if there's a pending invitation for this company and user
    EXISTS (
      SELECT 1 
      FROM driver_invitations di 
      WHERE di.company_id = driver_profiles.company_id 
      AND di.status = 'pending'
      AND di.email = auth.email()
    )
  )
);