-- Add missing SELECT policy for user_companies table
-- This is critical for users to access their company data

CREATE POLICY "Users can view their own company associations" 
ON public.user_companies 
FOR SELECT 
USING (user_id = (SELECT auth.uid()));