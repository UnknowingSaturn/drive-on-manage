-- Fix any missing RLS policies for driver creation
-- Allow admins to insert profiles for drivers
CREATE POLICY IF NOT EXISTS "Admins can create driver profiles for their companies 2" 
ON public.profiles 
FOR INSERT 
WITH CHECK (
  (user_type = 'driver' AND EXISTS (
    SELECT 1 FROM user_companies uc 
    WHERE uc.user_id = auth.uid() AND uc.role = 'admin'
  )) OR 
  (user_id = auth.uid())
);

-- Allow service role to create profiles during user creation
CREATE POLICY IF NOT EXISTS "Service role can create profiles" 
ON public.profiles 
FOR INSERT 
WITH CHECK (current_user = 'authenticator');

-- Allow service role to create user company associations
CREATE POLICY IF NOT EXISTS "Service role can create user companies" 
ON public.user_companies 
FOR INSERT 
WITH CHECK (current_user = 'authenticator');

-- Ensure the SOD screenshots bucket exists and is public
INSERT INTO storage.buckets (id, name, public) 
VALUES ('sod-screenshots', 'sod-screenshots', true)
ON CONFLICT (id) DO UPDATE SET public = true;