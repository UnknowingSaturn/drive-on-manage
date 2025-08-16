-- Add supervisor role to existing user types
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'supervisor';

-- Update user_companies role column to support supervisor
ALTER TABLE user_companies 
ALTER COLUMN role TYPE text;

-- Drop the existing enum constraint if it exists
ALTER TABLE user_companies 
DROP CONSTRAINT IF EXISTS user_companies_role_check;

-- Add new constraint that includes supervisor
ALTER TABLE user_companies 
ADD CONSTRAINT user_companies_role_check 
CHECK (role IN ('admin', 'supervisor', 'driver'));

-- Update profiles user_type to support supervisor
ALTER TABLE profiles 
DROP CONSTRAINT IF EXISTS profiles_user_type_check;

ALTER TABLE profiles 
ADD CONSTRAINT profiles_user_type_check 
CHECK (user_type IN ('admin', 'supervisor', 'driver'));

-- Create function to check if user has admin or supervisor role
CREATE OR REPLACE FUNCTION public.user_has_management_role(user_id_param uuid, company_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_companies 
    WHERE user_id = user_id_param 
    AND company_id = company_id_param
    AND role IN ('admin', 'supervisor')
  );
END;
$$;