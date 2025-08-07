-- Create database policies to prevent driver self-signup and enforce invitation-only access

-- Update profiles table RLS to prevent driver creation without invitation
DROP POLICY IF EXISTS "Users can create profiles" ON public.profiles;

-- Create secure policy for admin profiles only
CREATE POLICY "Admins can create admin profiles" ON public.profiles
FOR INSERT
WITH CHECK (user_id = auth.uid() AND user_type = 'admin');

-- Create secure policy for driver profiles (invitation only)
CREATE POLICY "Drivers can create profiles via invitation" ON public.profiles
FOR INSERT
WITH CHECK (
  user_id = auth.uid() 
  AND user_type = 'driver'
  AND EXISTS (
    SELECT 1 FROM driver_invitations 
    WHERE email = (auth.jwt() ->> 'email')
    AND status = 'pending'
    AND expires_at > now()
  )
);

-- Update driver_profiles to require valid company_id and prevent self-signup
DROP POLICY IF EXISTS "Allow authenticated users to create their own driver profile" ON public.driver_profiles;
DROP POLICY IF EXISTS "Temporary onboarding bypass" ON public.driver_profiles;

-- Create strict policy for driver profile creation
CREATE POLICY "Driver profiles require valid invitation" ON public.driver_profiles
FOR INSERT
WITH CHECK (
  user_id = auth.uid() 
  AND company_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM driver_invitations di
    WHERE di.email = (auth.jwt() ->> 'email')
    AND di.company_id = driver_profiles.company_id
    AND di.status = 'pending'
    AND di.expires_at > now()
  )
);

-- Create function to validate invitation tokens
CREATE OR REPLACE FUNCTION public.validate_invitation_token(token_param TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM driver_invitations
    WHERE invite_token = token_param
    AND status = 'pending'
    AND expires_at > now()
  );
END;
$$;