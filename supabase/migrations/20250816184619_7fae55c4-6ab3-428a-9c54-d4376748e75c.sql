-- Add RLS policies for schedules table to allow admin operations

-- Policy for admins to insert schedules for their company
CREATE POLICY "Admins can insert schedules for their company" 
ON public.schedules 
FOR INSERT 
WITH CHECK (
  user_has_company_role(auth.uid(), company_id, 'admin')
);

-- Policy for admins to update schedules for their company  
CREATE POLICY "Admins can update schedules for their company"
ON public.schedules
FOR UPDATE
USING (user_has_company_role(auth.uid(), company_id, 'admin'))
WITH CHECK (user_has_company_role(auth.uid(), company_id, 'admin'));

-- Policy for admins to delete schedules for their company
CREATE POLICY "Admins can delete schedules for their company"
ON public.schedules
FOR DELETE
USING (user_has_company_role(auth.uid(), company_id, 'admin'));

-- Policy for admins to view all schedules in their company
CREATE POLICY "Admins can view schedules for their company"
ON public.schedules
FOR SELECT
USING (user_has_company_role(auth.uid(), company_id, 'admin'));