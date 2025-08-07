-- Fix the SELECT policy for companies table
-- Same issue as INSERT - policy is only for 'authenticated' role but queries run as 'postgres'

-- Drop the existing SELECT policy
DROP POLICY IF EXISTS "Users can view their company" ON public.companies;

-- Create a new policy that works for both authenticated and postgres roles
CREATE POLICY "Users can view their company" ON public.companies
FOR SELECT 
TO authenticated, postgres
USING (
  id IN (
    SELECT profiles.company_id 
    FROM profiles 
    WHERE profiles.user_id = auth.uid()
  )
);