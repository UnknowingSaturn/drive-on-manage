-- Fix the companies RLS policy to prevent users from seeing other companies
-- Only allow users to see companies that match their own company_id

-- Drop the existing SELECT policy
DROP POLICY IF EXISTS "Users can view companies" ON public.companies;

-- Create a more secure policy
CREATE POLICY "Users can view their own company data" ON public.companies
FOR SELECT 
TO authenticated, postgres
USING (
  -- Only allow users to see companies that match their company_id
  id IN (
    SELECT profiles.company_id 
    FROM profiles 
    WHERE profiles.user_id = auth.uid()
    AND profiles.is_active = true
  )
);