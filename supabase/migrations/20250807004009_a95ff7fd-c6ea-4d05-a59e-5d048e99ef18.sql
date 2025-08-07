-- Drop the existing policy and create a more permissive one for onboarding
DROP POLICY IF EXISTS "Allow driver profile creation" ON public.driver_profiles;

-- Create a new policy that allows profile creation for:
-- 1. Admins creating profiles for their company
-- 2. Any authenticated user during onboarding (we'll validate via invitation token separately)
CREATE POLICY "Allow driver profile creation during onboarding" 
ON public.driver_profiles 
FOR INSERT 
WITH CHECK (
  user_id = auth.uid() AND (
    -- Admin creating profile for their company
    company_id IN (
      SELECT p.company_id 
      FROM profiles p 
      WHERE p.user_id = auth.uid() AND p.user_type = 'admin'
    )
    OR
    -- During onboarding - allow if there's a valid invitation for this company
    -- (we validate the invitation token in the application logic)
    company_id IN (
      SELECT DISTINCT company_id 
      FROM driver_invitations 
      WHERE status = 'pending' AND expires_at > now()
    )
  )
);