-- Add missing RLS policies for all tables (fixed version)

-- More RLS policies for rounds (admins can manage rounds in their company)
CREATE POLICY "Admins can view rounds in their company" ON public.rounds
FOR SELECT USING (
  company_id IN (
    SELECT company_id FROM public.profiles 
    WHERE user_id = auth.uid() AND user_type = 'admin'
  )
);

CREATE POLICY "Admins can insert rounds in their company" ON public.rounds
FOR INSERT WITH CHECK (
  company_id IN (
    SELECT company_id FROM public.profiles 
    WHERE user_id = auth.uid() AND user_type = 'admin'
  )
);

CREATE POLICY "Admins can update rounds in their company" ON public.rounds
FOR UPDATE USING (
  company_id IN (
    SELECT company_id FROM public.profiles 
    WHERE user_id = auth.uid() AND user_type = 'admin'
  )
);

CREATE POLICY "Admins can delete rounds in their company" ON public.rounds
FOR DELETE USING (
  company_id IN (
    SELECT company_id FROM public.profiles 
    WHERE user_id = auth.uid() AND user_type = 'admin'
  )
);

-- RLS policies for vans
CREATE POLICY "Company users can view vans" ON public.vans
FOR SELECT USING (
  company_id IN (
    SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Admins can insert vans" ON public.vans
FOR INSERT WITH CHECK (
  company_id IN (
    SELECT company_id FROM public.profiles 
    WHERE user_id = auth.uid() AND user_type = 'admin'
  )
);

CREATE POLICY "Admins can update vans" ON public.vans
FOR UPDATE USING (
  company_id IN (
    SELECT company_id FROM public.profiles 
    WHERE user_id = auth.uid() AND user_type = 'admin'
  )
);

CREATE POLICY "Admins can delete vans" ON public.vans
FOR DELETE USING (
  company_id IN (
    SELECT company_id FROM public.profiles 
    WHERE user_id = auth.uid() AND user_type = 'admin'
  )
);

-- More RLS policies for driver_profiles
CREATE POLICY "Admins can insert driver profiles" ON public.driver_profiles
FOR INSERT WITH CHECK (
  company_id IN (
    SELECT company_id FROM public.profiles 
    WHERE user_id = auth.uid() AND user_type = 'admin'
  )
);

CREATE POLICY "Admins can update driver profiles" ON public.driver_profiles
FOR UPDATE USING (
  company_id IN (
    SELECT company_id FROM public.profiles 
    WHERE user_id = auth.uid() AND user_type = 'admin'
  )
);

CREATE POLICY "Drivers can update their own profile" ON public.driver_profiles
FOR UPDATE USING (user_id = auth.uid());

-- RLS policies for daily_logs
CREATE POLICY "Drivers can view their own logs" ON public.daily_logs
FOR SELECT USING (
  driver_id IN (
    SELECT dp.id FROM public.driver_profiles dp WHERE dp.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can view logs in their company" ON public.daily_logs
FOR SELECT USING (
  company_id IN (
    SELECT company_id FROM public.profiles 
    WHERE user_id = auth.uid() AND user_type = 'admin'
  )
);

CREATE POLICY "Drivers can insert their own logs" ON public.daily_logs
FOR INSERT WITH CHECK (
  driver_id IN (
    SELECT dp.id FROM public.driver_profiles dp WHERE dp.user_id = auth.uid()
  )
);

CREATE POLICY "Drivers can update their own logs" ON public.daily_logs
FOR UPDATE USING (
  driver_id IN (
    SELECT dp.id FROM public.driver_profiles dp WHERE dp.user_id = auth.uid()
  )
);

-- RLS policies for vehicle_checks
CREATE POLICY "Drivers can view their own vehicle checks" ON public.vehicle_checks
FOR SELECT USING (
  driver_id IN (
    SELECT dp.id FROM public.driver_profiles dp WHERE dp.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can view vehicle checks in their company" ON public.vehicle_checks
FOR SELECT USING (
  van_id IN (
    SELECT v.id FROM public.vans v
    JOIN public.profiles p ON v.company_id = p.company_id
    WHERE p.user_id = auth.uid() AND p.user_type = 'admin'
  )
);

CREATE POLICY "Drivers can insert their own vehicle checks" ON public.vehicle_checks
FOR INSERT WITH CHECK (
  driver_id IN (
    SELECT dp.id FROM public.driver_profiles dp WHERE dp.user_id = auth.uid()
  )
);

-- RLS policies for incident_reports
CREATE POLICY "Drivers can view their own incident reports" ON public.incident_reports
FOR SELECT USING (
  driver_id IN (
    SELECT dp.id FROM public.driver_profiles dp WHERE dp.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can view incident reports in their company" ON public.incident_reports
FOR SELECT USING (
  company_id IN (
    SELECT company_id FROM public.profiles 
    WHERE user_id = auth.uid() AND user_type = 'admin'
  )
);

CREATE POLICY "Drivers can insert incident reports" ON public.incident_reports
FOR INSERT WITH CHECK (
  driver_id IN (
    SELECT dp.id FROM public.driver_profiles dp WHERE dp.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can update incident reports" ON public.incident_reports
FOR UPDATE USING (
  company_id IN (
    SELECT company_id FROM public.profiles 
    WHERE user_id = auth.uid() AND user_type = 'admin'
  )
);

-- RLS policies for announcements
CREATE POLICY "Company users can view announcements" ON public.announcements
FOR SELECT USING (
  company_id IN (
    SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Admins can insert announcements" ON public.announcements
FOR INSERT WITH CHECK (
  company_id IN (
    SELECT company_id FROM public.profiles 
    WHERE user_id = auth.uid() AND user_type = 'admin'
  )
);

CREATE POLICY "Admins can update announcements" ON public.announcements
FOR UPDATE USING (
  company_id IN (
    SELECT company_id FROM public.profiles 
    WHERE user_id = auth.uid() AND user_type = 'admin'
  )
);

CREATE POLICY "Admins can delete announcements" ON public.announcements
FOR DELETE USING (
  company_id IN (
    SELECT company_id FROM public.profiles 
    WHERE user_id = auth.uid() AND user_type = 'admin'
  )
);

-- Fix the search path issue in the existing function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, first_name, last_name, user_type)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name',
    COALESCE(NEW.raw_user_meta_data ->> 'user_type', 'driver')
  );
  RETURN NEW;
END;
$$;

-- Fix the timestamp function search path
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;