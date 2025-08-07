-- Add created_by field to companies table and update RLS policy
-- First, add the created_by column to track who created each company
ALTER TABLE public.companies 
ADD COLUMN created_by uuid REFERENCES auth.users(id);

-- Update existing companies to have a created_by value (set to the first admin user for existing data)
UPDATE public.companies 
SET created_by = (
  SELECT user_id 
  FROM profiles 
  WHERE user_type = 'admin' 
  AND is_active = true 
  LIMIT 1
) 
WHERE created_by IS NULL;

-- Make created_by required for new companies
ALTER TABLE public.companies 
ALTER COLUMN created_by SET NOT NULL;

-- Drop the existing SELECT policy
DROP POLICY IF EXISTS "Company visibility policy" ON public.companies;

-- Create a policy that only shows companies created by the current user
CREATE POLICY "Users can view companies they created" ON public.companies
FOR SELECT 
TO authenticated
USING (created_by = auth.uid());

-- Update the create_company_test function to set created_by
CREATE OR REPLACE FUNCTION public.create_company_test(company_name text, company_email text, company_phone text DEFAULT NULL::text, company_address text DEFAULT NULL::text, sub_tier text DEFAULT 'basic'::text)
 RETURNS TABLE(id uuid, name text, email text, phone text, address text, subscription_tier text, is_active boolean, created_at timestamp with time zone, updated_at timestamp with time zone)
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
  INSERT INTO companies (name, email, phone, address, subscription_tier, is_active, created_by)
  VALUES (company_name, company_email, company_phone, company_address, sub_tier, true, auth.uid())
  RETURNING companies.id INTO new_company_id;
  
  -- Return the created company
  RETURN QUERY
  SELECT c.id, c.name, c.email, c.phone, c.address, c.subscription_tier, c.is_active, c.created_at, c.updated_at
  FROM companies c
  WHERE c.id = new_company_id;
END;
$function$;