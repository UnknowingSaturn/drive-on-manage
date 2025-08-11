-- Force drop the company_id column with CASCADE to remove all dependent policies
ALTER TABLE public.profiles DROP COLUMN company_id CASCADE;

-- Add updated_at trigger for user_companies
CREATE TRIGGER update_user_companies_updated_at
BEFORE UPDATE ON public.user_companies
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Now recreate essential RLS policies using the new user_companies structure
CREATE POLICY "Admins can create driver profiles for their companies" 
ON public.profiles 
FOR INSERT 
WITH CHECK (
  user_type = 'driver' AND 
  EXISTS (
    SELECT 1 FROM user_companies uc
    WHERE uc.user_id = auth.uid() 
    AND uc.role = 'admin'
  )
);

CREATE POLICY "Admins can insert driver profiles for their companies" 
ON public.driver_profiles 
FOR INSERT 
WITH CHECK (
  public.user_has_company_role(auth.uid(), company_id, 'admin')
);

CREATE POLICY "Admins can update driver profiles in their companies" 
ON public.driver_profiles 
FOR UPDATE 
USING (
  public.user_has_company_role(auth.uid(), company_id, 'admin')
);

CREATE POLICY "Admins can view drivers in their companies" 
ON public.driver_profiles 
FOR SELECT 
USING (
  user_id = auth.uid() OR 
  public.user_has_company_role(auth.uid(), company_id, 'admin')
);

CREATE POLICY "Admins can update companies they manage" 
ON public.companies 
FOR UPDATE 
USING (
  public.user_has_company_role(auth.uid(), id, 'admin')
)
WITH CHECK (
  public.user_has_company_role(auth.uid(), id, 'admin')
);

CREATE POLICY "Users can view companies they belong to" 
ON public.companies 
FOR SELECT 
USING (
  created_by = auth.uid() OR 
  public.user_has_company_role(auth.uid(), id)
);

CREATE POLICY "Admins can manage company settings for their companies" 
ON public.company_settings 
FOR ALL 
USING (
  public.user_has_company_role(auth.uid(), company_id, 'admin')
)
WITH CHECK (
  public.user_has_company_role(auth.uid(), company_id, 'admin')
);

CREATE POLICY "Admins can view logs in their companies" 
ON public.daily_logs 
FOR SELECT 
USING (
  public.user_has_company_role(auth.uid(), company_id, 'admin') OR
  driver_id IN (SELECT dp.id FROM driver_profiles dp WHERE dp.user_id = auth.uid())
);

CREATE POLICY "Admins can update EOD reports in their companies" 
ON public.eod_reports 
FOR UPDATE 
USING (
  public.user_has_company_role(auth.uid(), company_id, 'admin')
);

CREATE POLICY "Admins can view EOD reports in their companies" 
ON public.eod_reports 
FOR SELECT 
USING (
  public.user_has_company_role(auth.uid(), company_id, 'admin') OR
  driver_id IN (SELECT dp.id FROM driver_profiles dp WHERE dp.user_id = auth.uid())
);

-- Add policies for vans
CREATE POLICY "Company users can view vans in their companies" 
ON public.vans 
FOR SELECT 
USING (
  public.user_has_company_role(auth.uid(), company_id)
);

CREATE POLICY "Admins can manage vans in their companies" 
ON public.vans 
FOR ALL 
USING (
  public.user_has_company_role(auth.uid(), company_id, 'admin')
)
WITH CHECK (
  public.user_has_company_role(auth.uid(), company_id, 'admin')
);

-- Add policies for rounds
CREATE POLICY "Admins can manage rounds in their companies" 
ON public.rounds 
FOR ALL 
USING (
  public.user_has_company_role(auth.uid(), company_id, 'admin')
)
WITH CHECK (
  public.user_has_company_role(auth.uid(), company_id, 'admin')
);