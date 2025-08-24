-- Optimize RLS policy for better performance
DROP POLICY IF EXISTS "Users can view company associations" ON user_companies;

CREATE POLICY "Users can view company associations" 
ON user_companies 
FOR SELECT 
USING (
  -- Users can see their own associations
  user_id = (SELECT auth.uid()) 
  OR 
  -- Admins can see all associations for their companies
  user_is_company_admin((SELECT auth.uid()), company_id)
);