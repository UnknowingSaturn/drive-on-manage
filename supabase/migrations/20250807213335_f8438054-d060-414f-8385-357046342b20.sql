-- Fix the companies ownership issue by removing all existing companies
-- This ensures users only see companies they create going forward

-- Remove all existing companies (since ownership was incorrectly assigned)
DELETE FROM public.companies;

-- Update the RLS policy to only show companies created by the current user
DROP POLICY IF EXISTS "Users can view companies they created" ON public.companies;

CREATE POLICY "Users can view companies they created" ON public.companies
FOR SELECT 
TO authenticated
USING (created_by = auth.uid());