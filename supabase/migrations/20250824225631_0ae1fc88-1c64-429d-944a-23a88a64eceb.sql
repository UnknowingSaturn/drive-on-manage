-- Fix RLS policy for user_companies to allow admins to view other company members
DROP POLICY IF EXISTS "Users can view their own company associations" ON user_companies;

CREATE POLICY "Users can view company associations" 
ON user_companies 
FOR SELECT 
USING (
  -- Users can see their own associations
  user_id = auth.uid() 
  OR 
  -- Admins can see all associations for their companies
  (
    company_id IN (
      SELECT uc.company_id 
      FROM user_companies uc 
      WHERE uc.user_id = auth.uid() 
      AND uc.role = 'admin'
    )
  )
);