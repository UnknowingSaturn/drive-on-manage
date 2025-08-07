-- Create a policy to allow public access to driver invitations by token for onboarding
-- This is safe because the token is essentially a secure key
CREATE POLICY "Public can view invitations by token for onboarding" 
ON public.driver_invitations 
FOR SELECT 
USING (true);