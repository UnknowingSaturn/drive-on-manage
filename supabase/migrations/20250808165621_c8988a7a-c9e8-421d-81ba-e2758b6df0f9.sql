-- COMPREHENSIVE DATABASE & SECURITY CLEANUP

-- 1. Fix remaining function security settings
ALTER FUNCTION public.audit_rls_coverage() 
SET search_path = public;

ALTER FUNCTION public.get_cleanup_recommendations() 
SET search_path = public;

ALTER FUNCTION public.get_validation_summary() 
SET search_path = public;

ALTER FUNCTION public.identify_cleanup_candidates() 
SET search_path = public;

ALTER FUNCTION public.test_validation_system() 
SET search_path = public;

-- 2. Add missing foreign key constraints for data integrity
-- Company references
ALTER TABLE public.announcements 
ADD CONSTRAINT fk_announcements_company 
FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

ALTER TABLE public.driver_profiles 
ADD CONSTRAINT fk_driver_profiles_company 
FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

ALTER TABLE public.driver_invitations 
ADD CONSTRAINT fk_driver_invitations_company 
FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

ALTER TABLE public.eod_reports 
ADD CONSTRAINT fk_eod_reports_company 
FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

ALTER TABLE public.eod_reports 
ADD CONSTRAINT fk_eod_reports_driver 
FOREIGN KEY (driver_id) REFERENCES public.driver_profiles(id) ON DELETE CASCADE;

ALTER TABLE public.incident_reports 
ADD CONSTRAINT fk_incident_reports_company 
FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

ALTER TABLE public.incident_reports 
ADD CONSTRAINT fk_incident_reports_driver 
FOREIGN KEY (driver_id) REFERENCES public.driver_profiles(id) ON DELETE CASCADE;

ALTER TABLE public.operating_costs 
ADD CONSTRAINT fk_operating_costs_company 
FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

ALTER TABLE public.payments 
ADD CONSTRAINT fk_payments_company 
FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

ALTER TABLE public.payments 
ADD CONSTRAINT fk_payments_driver 
FOREIGN KEY (driver_id) REFERENCES public.driver_profiles(id) ON DELETE CASCADE;

ALTER TABLE public.payments 
ADD CONSTRAINT fk_payments_eod_report 
FOREIGN KEY (eod_report_id) REFERENCES public.eod_reports(id) ON DELETE CASCADE;

ALTER TABLE public.rounds 
ADD CONSTRAINT fk_rounds_company 
FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

ALTER TABLE public.schedules 
ADD CONSTRAINT fk_schedules_company 
FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

ALTER TABLE public.schedules 
ADD CONSTRAINT fk_schedules_driver 
FOREIGN KEY (driver_id) REFERENCES public.driver_profiles(id) ON DELETE CASCADE;

ALTER TABLE public.schedules 
ADD CONSTRAINT fk_schedules_round 
FOREIGN KEY (round_id) REFERENCES public.rounds(id) ON DELETE CASCADE;

ALTER TABLE public.vans 
ADD CONSTRAINT fk_vans_company 
FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

-- Van and round references
ALTER TABLE public.driver_profiles 
ADD CONSTRAINT fk_driver_profiles_van 
FOREIGN KEY (assigned_van_id) REFERENCES public.vans(id) ON DELETE SET NULL;

ALTER TABLE public.eod_reports 
ADD CONSTRAINT fk_eod_reports_van 
FOREIGN KEY (van_id) REFERENCES public.vans(id) ON DELETE SET NULL;

ALTER TABLE public.sod_logs 
ADD CONSTRAINT fk_sod_logs_company 
FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

ALTER TABLE public.sod_logs 
ADD CONSTRAINT fk_sod_logs_driver 
FOREIGN KEY (driver_id) REFERENCES public.driver_profiles(id) ON DELETE CASCADE;

ALTER TABLE public.sod_logs 
ADD CONSTRAINT fk_sod_logs_van 
FOREIGN KEY (van_id) REFERENCES public.vans(id) ON DELETE SET NULL;

ALTER TABLE public.vehicle_checks 
ADD CONSTRAINT fk_vehicle_checks_driver 
FOREIGN KEY (driver_id) REFERENCES public.driver_profiles(id) ON DELETE CASCADE;

ALTER TABLE public.vehicle_checks 
ADD CONSTRAINT fk_vehicle_checks_van 
FOREIGN KEY (van_id) REFERENCES public.vans(id) ON DELETE CASCADE;

ALTER TABLE public.route_feedback 
ADD CONSTRAINT fk_route_feedback_company 
FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

ALTER TABLE public.route_feedback 
ADD CONSTRAINT fk_route_feedback_driver 
FOREIGN KEY (driver_id) REFERENCES public.driver_profiles(id) ON DELETE CASCADE;

ALTER TABLE public.route_feedback 
ADD CONSTRAINT fk_route_feedback_eod_report 
FOREIGN KEY (eod_report_id) REFERENCES public.eod_reports(id) ON DELETE SET NULL;

ALTER TABLE public.route_feedback 
ADD CONSTRAINT fk_route_feedback_round 
FOREIGN KEY (round_id) REFERENCES public.rounds(id) ON DELETE SET NULL;

-- 3. Fix company_id nullability for better data integrity
ALTER TABLE public.profiles 
ALTER COLUMN company_id SET NOT NULL;

-- 4. Add unique constraints to prevent data duplication
ALTER TABLE public.driver_profiles 
ADD CONSTRAINT unique_user_per_company 
UNIQUE (user_id, company_id);

ALTER TABLE public.sod_logs 
ADD CONSTRAINT unique_sod_per_driver_date 
UNIQUE (driver_id, log_date);

ALTER TABLE public.eod_reports 
ADD CONSTRAINT unique_eod_per_driver_date 
UNIQUE (driver_id, log_date);

-- 5. Improve RLS policies for better company isolation
-- Update profiles policy to prevent cross-company access
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (user_id = auth.uid());

-- Ensure all company-related tables have proper isolation
DROP POLICY IF EXISTS "Drivers can view their own logs" ON public.daily_logs;
CREATE POLICY "Drivers can view their own logs" 
ON public.daily_logs 
FOR SELECT 
USING (
  driver_id IN (
    SELECT dp.id 
    FROM driver_profiles dp 
    WHERE dp.user_id = auth.uid()
  )
  AND company_id IN (
    SELECT p.company_id 
    FROM profiles p 
    WHERE p.user_id = auth.uid()
  )
);

-- 6. Add storage bucket policies for secure file access
INSERT INTO storage.buckets (id, name, public) 
VALUES ('driver-documents', 'driver-documents', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('driver-avatars', 'driver-avatars', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('eod-screenshots', 'eod-screenshots', false)
ON CONFLICT (id) DO NOTHING;

-- Secure storage policies
CREATE POLICY "Drivers can upload their own documents" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'driver-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Drivers can view their own documents" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'driver-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Admins can view company documents" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'driver-documents' 
  AND EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.user_id = auth.uid() 
    AND p.user_type = 'admin'
  )
);

CREATE POLICY "Anyone can view public avatars" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'driver-avatars');

CREATE POLICY "Drivers can upload their own avatars" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'driver-avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Drivers can upload EOD screenshots" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'eod-screenshots' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Drivers can view their own EOD screenshots" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'eod-screenshots' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Admins can view company EOD screenshots" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'eod-screenshots' 
  AND EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.user_id = auth.uid() 
    AND p.user_type = 'admin'
  )
);

-- 7. Remove unused functions that are no longer needed
DROP FUNCTION IF EXISTS public.create_company_test(text, text, text, text);

-- 8. Add indexes for better performance on foreign key columns
CREATE INDEX IF NOT EXISTS idx_driver_profiles_company_id ON public.driver_profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_driver_profiles_user_id ON public.driver_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_eod_reports_driver_date ON public.eod_reports(driver_id, log_date);
CREATE INDEX IF NOT EXISTS idx_eod_reports_company_id ON public.eod_reports(company_id);
CREATE INDEX IF NOT EXISTS idx_payments_driver_id ON public.payments(driver_id);
CREATE INDEX IF NOT EXISTS idx_schedules_driver_date ON public.schedules(driver_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_profiles_company_user ON public.profiles(company_id, user_id);