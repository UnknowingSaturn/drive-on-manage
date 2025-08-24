-- Update profiles RLS policy to allow viewing admin/supervisor profiles within same company

DROP POLICY IF EXISTS "Users can view profiles" ON public.profiles;

CREATE POLICY "Users can view profiles" ON public.profiles
FOR SELECT USING (
  -- Users can see their own profile
  user_id = auth.uid() 
  OR 
  -- Users can see driver profiles in their company (if they're admin)
  (
    user_type = 'driver' 
    AND EXISTS (
      SELECT 1 
      FROM user_companies uc1, user_companies uc2
      WHERE uc1.user_id = auth.uid() 
        AND uc1.role = 'admin' 
        AND uc2.user_id = profiles.user_id 
        AND uc1.company_id = uc2.company_id
    )
  )
  OR
  -- Users can see admin/supervisor profiles in their company (if they're admin or supervisor)
  (
    user_type IN ('admin', 'supervisor')
    AND EXISTS (
      SELECT 1 
      FROM user_companies uc1, user_companies uc2
      WHERE uc1.user_id = auth.uid() 
        AND uc1.role IN ('admin', 'supervisor') 
        AND uc2.user_id = profiles.user_id 
        AND uc1.company_id = uc2.company_id
    )
  )
);