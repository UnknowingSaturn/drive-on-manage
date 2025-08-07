-- Fix the RLS policy for company insertion
-- The issue is that the policy is only for 'authenticated' role but queries are running as 'postgres'

-- Drop the existing INSERT policy
DROP POLICY IF EXISTS "Admins can insert companies" ON public.companies;

-- Create a new policy that works for both authenticated and postgres roles
CREATE POLICY "Admins can insert companies" ON public.companies
FOR INSERT 
TO authenticated, postgres
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.user_type = 'admin'
    AND profiles.is_active = true
  )
);