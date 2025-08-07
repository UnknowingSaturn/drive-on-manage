-- Temporarily create a test function to verify the company creation works without RLS
CREATE OR REPLACE FUNCTION public.create_company_test(
  company_name text,
  company_email text,
  company_phone text DEFAULT NULL,
  company_address text DEFAULT NULL,
  subscription_tier text DEFAULT 'basic'
)
RETURNS TABLE(
  id uuid,
  name text,
  email text,
  phone text,
  address text,
  subscription_tier text,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_company_id uuid;
  user_is_admin boolean;
BEGIN
  -- Check if the current user is an admin
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.user_type = 'admin'
    AND profiles.is_active = true
  ) INTO user_is_admin;
  
  -- Raise an error if not admin
  IF NOT user_is_admin THEN
    RAISE EXCEPTION 'Access denied: Only active admin users can create companies';
  END IF;
  
  -- Insert the company
  INSERT INTO companies (name, email, phone, address, subscription_tier, is_active)
  VALUES (company_name, company_email, company_phone, company_address, subscription_tier, true)
  RETURNING companies.id INTO new_company_id;
  
  -- Return the created company
  RETURN QUERY
  SELECT c.id, c.name, c.email, c.phone, c.address, c.subscription_tier, c.is_active, c.created_at, c.updated_at
  FROM companies c
  WHERE c.id = new_company_id;
END;
$$;