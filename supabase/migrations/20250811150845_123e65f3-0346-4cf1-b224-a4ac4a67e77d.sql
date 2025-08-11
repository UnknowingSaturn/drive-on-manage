-- Fix RLS policies for proper driver management

-- Update driver_profiles policies to ensure admins can insert for their company
DROP POLICY IF EXISTS "Admins can create driver profiles directly" ON public.driver_profiles;
DROP POLICY IF EXISTS "Admins can create driver profiles for their company" ON public.driver_profiles;

-- Create unified policy for admin insertions
CREATE POLICY "Admins can insert driver profiles for their company" 
ON public.driver_profiles 
FOR INSERT 
TO authenticated
WITH CHECK (
  company_id IN (
    SELECT p.company_id 
    FROM profiles p 
    WHERE p.user_id = auth.uid() 
    AND p.user_type = 'admin'
    AND p.is_active = true
  )
);

-- Ensure drivers can only read/write their own profile
CREATE POLICY "Drivers can manage their own profile" 
ON public.driver_profiles 
FOR ALL 
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Add policy for profiles table to allow admin creation of driver profiles
CREATE POLICY "Admins can create driver profiles" 
ON public.profiles 
FOR INSERT 
TO authenticated
WITH CHECK (
  user_type = 'driver' 
  AND company_id IN (
    SELECT p.company_id 
    FROM profiles p 
    WHERE p.user_id = auth.uid() 
    AND p.user_type = 'admin'
    AND p.is_active = true
  )
);