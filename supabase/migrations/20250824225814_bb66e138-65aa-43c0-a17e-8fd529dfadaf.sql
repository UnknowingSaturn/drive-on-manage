-- Fix infinite recursion in user_companies RLS policy
DROP POLICY IF EXISTS "Users can view company associations" ON user_companies;

-- Create a security definer function to check if user is admin of a company
CREATE OR REPLACE FUNCTION public.user_is_company_admin(user_id_param UUID, company_id_param UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM user_companies 
    WHERE user_id = user_id_param 
    AND company_id = company_id_param 
    AND role = 'admin'
  );
END;
$$;

-- Create the corrected policy using the security definer function
CREATE POLICY "Users can view company associations" 
ON user_companies 
FOR SELECT 
USING (
  -- Users can see their own associations
  user_id = auth.uid() 
  OR 
  -- Admins can see all associations for their companies
  user_is_company_admin(auth.uid(), company_id)
);