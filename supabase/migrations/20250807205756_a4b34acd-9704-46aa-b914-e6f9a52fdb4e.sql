-- Fix the RLS policy for company creation by admins
-- The current policy might have an issue with the auth context

-- Drop the existing policy
DROP POLICY IF EXISTS "Admins can insert companies" ON public.companies;

-- Create a new, more explicit policy for company creation
CREATE POLICY "Admins can insert companies" ON public.companies
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.user_type = 'admin'
    AND profiles.is_active = true
  )
);