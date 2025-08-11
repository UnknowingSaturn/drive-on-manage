-- Add missing RLS policies for all tables that need them

-- Profiles policies
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

-- Driver profiles policies
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

-- Companies policies
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

-- Company settings policies
CREATE POLICY "Admins can manage company settings for their companies" 
ON public.company_settings 
FOR ALL 
USING (
  public.user_has_company_role(auth.uid(), company_id, 'admin')
)
WITH CHECK (
  public.user_has_company_role(auth.uid(), company_id, 'admin')
);

-- Daily logs policies
CREATE POLICY "Admins can view logs in their companies" 
ON public.daily_logs 
FOR SELECT 
USING (
  public.user_has_company_role(auth.uid(), company_id, 'admin') OR
  driver_id IN (SELECT dp.id FROM driver_profiles dp WHERE dp.user_id = auth.uid())
);

-- EOD reports policies
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

-- Vans policies
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

-- Rounds policies  
CREATE POLICY "Admins can manage rounds in their companies" 
ON public.rounds 
FOR ALL 
USING (
  public.user_has_company_role(auth.uid(), company_id, 'admin')
)
WITH CHECK (
  public.user_has_company_role(auth.uid(), company_id, 'admin')
);

-- Add remaining essential policies for other tables
CREATE POLICY "Admins can manage announcements in their companies" 
ON public.announcements 
FOR ALL 
USING (
  public.user_has_company_role(auth.uid(), company_id, 'admin')
)
WITH CHECK (
  public.user_has_company_role(auth.uid(), company_id, 'admin')
);

CREATE POLICY "Company users can view announcements in their companies" 
ON public.announcements 
FOR SELECT 
USING (
  public.user_has_company_role(auth.uid(), company_id)
);

CREATE POLICY "Company users can view and send messages in their companies" 
ON public.messages 
FOR ALL 
USING (
  public.user_has_company_role(auth.uid(), company_id)
)
WITH CHECK (
  public.user_has_company_role(auth.uid(), company_id) AND sender_id = auth.uid()
);

CREATE POLICY "Admins can manage all company data in their companies" 
ON public.operating_costs 
FOR ALL 
USING (
  public.user_has_company_role(auth.uid(), company_id, 'admin')
)
WITH CHECK (
  public.user_has_company_role(auth.uid(), company_id, 'admin')
);

CREATE POLICY "Admins can manage schedules in their companies" 
ON public.schedules 
FOR ALL 
USING (
  public.user_has_company_role(auth.uid(), company_id, 'admin')
)
WITH CHECK (
  public.user_has_company_role(auth.uid(), company_id, 'admin')
);

CREATE POLICY "Drivers can view their own schedules" 
ON public.schedules 
FOR SELECT 
USING (
  driver_id IN (SELECT dp.id FROM driver_profiles dp WHERE dp.user_id = auth.uid())
);