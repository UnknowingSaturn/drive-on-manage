-- Fix the SELECT policy role for companies table
-- The SELECT policy is set for 'public' role but should be for 'authenticated' role

-- Drop the existing SELECT policy
DROP POLICY IF EXISTS "Users can view their company" ON public.companies;

-- Create the SELECT policy with the correct role targeting
CREATE POLICY "Users can view their company" ON public.companies
FOR SELECT 
TO authenticated
USING (
  id IN (
    SELECT profiles.company_id 
    FROM profiles 
    WHERE profiles.user_id = auth.uid()
  )
);