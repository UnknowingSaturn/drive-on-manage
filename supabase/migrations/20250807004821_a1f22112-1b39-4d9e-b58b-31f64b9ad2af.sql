-- Drop all existing INSERT policies for driver_profiles
DROP POLICY IF EXISTS "Allow driver profile creation during onboarding" ON public.driver_profiles;
DROP POLICY IF EXISTS "Admins can insert driver profiles" ON public.driver_profiles;

-- Create a simple policy that allows any authenticated user to create their own profile
-- We'll validate the invitation in the application logic
CREATE POLICY "Allow authenticated users to create their own driver profile" 
ON public.driver_profiles 
FOR INSERT 
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Keep the admin policy for admin-created profiles
CREATE POLICY "Admins can create driver profiles for their company" 
ON public.driver_profiles 
FOR INSERT 
TO authenticated
WITH CHECK (
  company_id IN (
    SELECT p.company_id 
    FROM profiles p 
    WHERE p.user_id = auth.uid() AND p.user_type = 'admin'
  )
);