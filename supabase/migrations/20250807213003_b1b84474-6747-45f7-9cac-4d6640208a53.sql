-- Fix RLS policy to allow admins to see all companies
-- Drop the existing overly restrictive policy
DROP POLICY IF EXISTS "Users can view their own company data" ON public.companies;

-- Create a policy that allows admins to see all companies, regular users only their company
CREATE POLICY "Company visibility policy" ON public.companies
FOR SELECT 
TO authenticated, postgres
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.is_active = true
    AND (
      -- Admin users can see all companies
      profiles.user_type = 'admin'
      OR
      -- Regular users can only see their assigned company
      (profiles.user_type != 'admin' AND profiles.company_id = companies.id)
    )
  )
);