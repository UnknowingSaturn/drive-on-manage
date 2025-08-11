-- Fix profiles RLS policies to allow admins to view driver profiles in their companies

-- Add policy for admins to view driver profiles in their companies
CREATE POLICY "Admins can view driver profiles in their companies" 
ON profiles 
FOR SELECT 
USING (
  user_id = auth.uid() 
  OR 
  (
    user_type = 'driver' 
    AND EXISTS (
      SELECT 1 FROM user_companies uc1, user_companies uc2
      WHERE uc1.user_id = auth.uid() 
        AND uc1.role = 'admin'
        AND uc2.user_id = profiles.user_id
        AND uc1.company_id = uc2.company_id
    )
  )
);