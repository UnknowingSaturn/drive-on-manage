-- Enable Row Level Security on company_settings table
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can view company settings for their companies
CREATE POLICY "Admins can view company settings for their companies" 
ON public.company_settings 
FOR SELECT 
USING (user_has_company_role(auth.uid(), company_id, 'admin'::text));

-- Policy: Admins can insert company settings for their companies
CREATE POLICY "Admins can insert company settings for their companies" 
ON public.company_settings 
FOR INSERT 
WITH CHECK (user_has_company_role(auth.uid(), company_id, 'admin'::text));

-- Policy: Admins can update company settings for their companies
CREATE POLICY "Admins can update company settings for their companies" 
ON public.company_settings 
FOR UPDATE 
USING (user_has_company_role(auth.uid(), company_id, 'admin'::text))
WITH CHECK (user_has_company_role(auth.uid(), company_id, 'admin'::text));

-- Policy: Admins can delete company settings for their companies
CREATE POLICY "Admins can delete company settings for their companies" 
ON public.company_settings 
FOR DELETE 
USING (user_has_company_role(auth.uid(), company_id, 'admin'::text));