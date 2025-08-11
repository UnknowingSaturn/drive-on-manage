-- Fix user_companies RLS policies to allow admin insertion of driver associations
-- Drop existing policies
DROP POLICY IF EXISTS "Users can manage their own company associations" ON user_companies;
DROP POLICY IF EXISTS "Users can view their own company associations" ON user_companies;

-- Create new policies that allow admins to manage driver associations
CREATE POLICY "Users can view their own company associations" 
ON user_companies 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Users can manage their own company associations" 
ON user_companies 
FOR ALL 
USING (user_id = auth.uid()) 
WITH CHECK (user_id = auth.uid());

-- NEW: Allow admins to create driver associations for their companies
CREATE POLICY "Admins can create driver associations for their companies" 
ON user_companies 
FOR INSERT 
WITH CHECK (
  -- The admin must have admin role in the company they're adding someone to
  EXISTS (
    SELECT 1 FROM user_companies uc 
    WHERE uc.user_id = auth.uid() 
    AND uc.company_id = user_companies.company_id 
    AND uc.role = 'admin'
  )
);