-- Fix the RLS policy role for company creation
-- The policy was created for 'public' role but should be for 'authenticated' role

-- Drop the existing policy
DROP POLICY IF EXISTS "Admins can insert companies" ON public.companies;

-- Create the policy with the correct role targeting
CREATE POLICY "Admins can insert companies" ON public.companies
FOR INSERT 
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.user_type = 'admin'
    AND profiles.is_active = true
  )
);