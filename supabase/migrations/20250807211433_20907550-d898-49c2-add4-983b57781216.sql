-- Create a debug function to test authentication context
CREATE OR REPLACE FUNCTION public.test_auth_context()
RETURNS TABLE(
  current_uid uuid,
  current_role text,
  jwt_claims jsonb,
  profile_exists boolean,
  profile_data jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    auth.uid() as current_uid,
    current_user as current_role,
    auth.jwt() as jwt_claims,
    EXISTS(SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid()) as profile_exists,
    to_jsonb(p.*) as profile_data
  FROM profiles p 
  WHERE p.user_id = auth.uid()
  LIMIT 1;
  
  -- If no profile found, return with nulls
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      auth.uid() as current_uid,
      current_user as current_role,
      auth.jwt() as jwt_claims,
      false as profile_exists,
      NULL::jsonb as profile_data;
  END IF;
END;
$$;