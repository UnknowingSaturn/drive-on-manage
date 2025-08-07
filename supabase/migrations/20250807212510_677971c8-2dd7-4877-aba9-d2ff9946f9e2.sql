-- Fix the SELECT policy for companies - admins should see all companies
-- Drop the existing SELECT policy
DROP POLICY IF EXISTS "Users can view their company" ON public.companies;

-- Create a new policy that allows admins to see all companies
CREATE POLICY "Users can view companies" ON public.companies
FOR SELECT 
TO authenticated, postgres
USING (
  -- Admin users can see all companies
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.user_type = 'admin'
    AND profiles.is_active = true
  )
  OR
  -- Regular users can only see their own company
  id IN (
    SELECT profiles.company_id 
    FROM profiles 
    WHERE profiles.user_id = auth.uid()
    AND profiles.user_type != 'admin'
  )
);