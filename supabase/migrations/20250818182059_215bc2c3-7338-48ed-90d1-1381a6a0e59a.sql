-- Allow admins to update SOD reports in their companies
CREATE POLICY "Admins can update SOD reports in their companies" 
ON public.start_of_day_reports 
FOR UPDATE 
USING (company_id IN ( SELECT uc.company_id
   FROM user_companies uc
  WHERE ((uc.user_id = auth.uid()) AND (uc.role = 'admin'::text))))
WITH CHECK (company_id IN ( SELECT uc.company_id
   FROM user_companies uc
  WHERE ((uc.user_id = auth.uid()) AND (uc.role = 'admin'::text))));