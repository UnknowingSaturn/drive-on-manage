-- Enable Row Level Security on operating_costs table
ALTER TABLE public.operating_costs ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can view operating costs for their companies
CREATE POLICY "Admins can view operating costs for their companies" 
ON public.operating_costs 
FOR SELECT 
USING (user_has_company_role(auth.uid(), company_id, 'admin'::text));

-- Policy: Admins can insert operating costs for their companies
CREATE POLICY "Admins can insert operating costs for their companies" 
ON public.operating_costs 
FOR INSERT 
WITH CHECK (
  user_has_company_role(auth.uid(), company_id, 'admin'::text) 
  AND created_by = auth.uid()
);

-- Policy: Admins can update operating costs for their companies
CREATE POLICY "Admins can update operating costs for their companies" 
ON public.operating_costs 
FOR UPDATE 
USING (user_has_company_role(auth.uid(), company_id, 'admin'::text))
WITH CHECK (user_has_company_role(auth.uid(), company_id, 'admin'::text));

-- Policy: Admins can delete operating costs for their companies
CREATE POLICY "Admins can delete operating costs for their companies" 
ON public.operating_costs 
FOR DELETE 
USING (user_has_company_role(auth.uid(), company_id, 'admin'::text));