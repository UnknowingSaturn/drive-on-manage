-- Fix any missing RLS policies for driver creation
-- Allow service role to create profiles during user creation
CREATE POLICY "Service role can create profiles" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.role() = 'service_role');

-- Allow service role to create user company associations
CREATE POLICY "Service role can create user companies" 
ON public.user_companies 
FOR INSERT 
WITH CHECK (auth.role() = 'service_role');

-- Ensure the SOD screenshots bucket exists and is public
INSERT INTO storage.buckets (id, name, public) 
VALUES ('sod-screenshots', 'sod-screenshots', true)
ON CONFLICT (id) DO UPDATE SET public = true;