-- Drop the temporary policy and create a comprehensive one that handles onboarding properly
DROP POLICY "Temporary permissive driver profile creation" ON public.driver_profiles;

-- Create a robust policy for driver profile creation that works during onboarding
CREATE POLICY "Allow driver profile creation" 
ON public.driver_profiles 
FOR INSERT 
WITH CHECK (
  user_id = auth.uid() AND (
    -- Allow if user is admin in the company
    company_id IN (
      SELECT p.company_id 
      FROM profiles p 
      WHERE p.user_id = auth.uid() AND p.user_type = 'admin'
    )
    OR
    -- Allow during onboarding if there's a valid pending invitation
    -- Use the user's email from auth.email() and match with invitation
    company_id IN (
      SELECT di.company_id 
      FROM driver_invitations di 
      WHERE di.email = auth.email()
      AND di.status = 'pending'
      AND di.expires_at > now()
    )
  )
);