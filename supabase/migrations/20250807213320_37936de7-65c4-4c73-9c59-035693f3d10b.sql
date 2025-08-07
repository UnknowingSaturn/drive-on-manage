-- Fix the companies ownership issue
-- Remove the NOT NULL constraint temporarily
ALTER TABLE public.companies 
ALTER COLUMN created_by DROP NOT NULL;

-- Clear ownership of all existing companies so they won't be visible
-- Users will need to recreate their companies
UPDATE public.companies 
SET created_by = NULL;

-- Update the RLS policy to only show companies with a created_by value that matches the current user
DROP POLICY IF EXISTS "Users can view companies they created" ON public.companies;

CREATE POLICY "Users can view companies they created" ON public.companies
FOR SELECT 
TO authenticated
USING (created_by = auth.uid() AND created_by IS NOT NULL);

-- Add the NOT NULL constraint back for future companies
ALTER TABLE public.companies 
ALTER COLUMN created_by SET NOT NULL;