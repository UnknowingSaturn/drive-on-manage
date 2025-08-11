-- Fix the driver creation to ensure password remains valid
-- The issue is that createUser with email_confirm: true might cause password issues
-- Let's ensure the user's password is properly set

-- First, let's add a function to properly set driver passwords
CREATE OR REPLACE FUNCTION public.set_driver_password(
  user_email text,
  new_password text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update the user's password in auth.users
  UPDATE auth.users 
  SET encrypted_password = crypt(new_password, gen_salt('bf'))
  WHERE email = user_email;
END;
$$;