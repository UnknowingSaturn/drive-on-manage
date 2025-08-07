-- Drop and recreate the function without subscription_tier
DROP FUNCTION public.create_company_test(text,text,text,text,text);

CREATE FUNCTION public.create_company_test(company_name text, company_email text, company_phone text DEFAULT NULL::text, company_address text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, name text, email text, phone text, address text, is_active boolean, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  
  -- Insert the company with created_by set to current user
  INSERT INTO companies (name, email, phone, address, is_active, created_by)
  VALUES (company_name, company_email, company_phone, company_address, true, auth.uid())
  RETURNING companies.id INTO new_company_id;
  
  -- Return the created company
  RETURN QUERY
  SELECT c.id, c.name, c.email, c.phone, c.address, c.is_active, c.created_at, c.updated_at
  FROM companies c
  WHERE c.id = new_company_id;
END;
$function$