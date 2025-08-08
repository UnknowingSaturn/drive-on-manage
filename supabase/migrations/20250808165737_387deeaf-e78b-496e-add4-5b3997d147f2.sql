-- COMPREHENSIVE DATABASE & SECURITY CLEANUP (FIXED)

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

-- 2. Add missing foreign key constraints (check if exists first)
DO $$ 
BEGIN
    -- Company references
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_announcements_company') THEN
        ALTER TABLE public.announcements 
        ADD CONSTRAINT fk_announcements_company 
        FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_driver_profiles_company') THEN
        ALTER TABLE public.driver_profiles 
        ADD CONSTRAINT fk_driver_profiles_company 
        FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_eod_reports_driver') THEN
        ALTER TABLE public.eod_reports 
        ADD CONSTRAINT fk_eod_reports_driver 
        FOREIGN KEY (driver_id) REFERENCES public.driver_profiles(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_eod_reports_company') THEN
        ALTER TABLE public.eod_reports 
        ADD CONSTRAINT fk_eod_reports_company 
        FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_incident_reports_company') THEN
        ALTER TABLE public.incident_reports 
        ADD CONSTRAINT fk_incident_reports_company 
        FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_incident_reports_driver') THEN
        ALTER TABLE public.incident_reports 
        ADD CONSTRAINT fk_incident_reports_driver 
        FOREIGN KEY (driver_id) REFERENCES public.driver_profiles(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_vans_company') THEN
        ALTER TABLE public.vans 
        ADD CONSTRAINT fk_vans_company 
        FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_rounds_company') THEN
        ALTER TABLE public.rounds 
        ADD CONSTRAINT fk_rounds_company 
        FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 3. Add unique constraints to prevent data duplication
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_user_per_company') THEN
        ALTER TABLE public.driver_profiles 
        ADD CONSTRAINT unique_user_per_company 
        UNIQUE (user_id, company_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_sod_per_driver_date') THEN
        ALTER TABLE public.sod_logs 
        ADD CONSTRAINT unique_sod_per_driver_date 
        UNIQUE (driver_id, log_date);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_eod_per_driver_date') THEN
        ALTER TABLE public.eod_reports 
        ADD CONSTRAINT unique_eod_per_driver_date 
        UNIQUE (driver_id, log_date);
    END IF;
END $$;

-- 4. Improve RLS policies for better company isolation
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

-- 5. Secure storage policies (create if not exists)
DO $$
BEGIN
    -- Storage buckets
    INSERT INTO storage.buckets (id, name, public) 
    VALUES ('driver-documents', 'driver-documents', false)
    ON CONFLICT (id) DO UPDATE SET public = false;

    INSERT INTO storage.buckets (id, name, public) 
    VALUES ('driver-avatars', 'driver-avatars', true)
    ON CONFLICT (id) DO UPDATE SET public = true;

    INSERT INTO storage.buckets (id, name, public) 
    VALUES ('eod-screenshots', 'eod-screenshots', false)
    ON CONFLICT (id) DO UPDATE SET public = false;
END $$;

-- Storage policies (drop and recreate to ensure they're correct)
DROP POLICY IF EXISTS "Drivers can upload their own documents" ON storage.objects;
CREATE POLICY "Drivers can upload their own documents" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'driver-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Drivers can view their own documents" ON storage.objects;
CREATE POLICY "Drivers can view their own documents" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'driver-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Admins can view company documents" ON storage.objects;
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

DROP POLICY IF EXISTS "Anyone can view public avatars" ON storage.objects;
CREATE POLICY "Anyone can view public avatars" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'driver-avatars');

DROP POLICY IF EXISTS "Drivers can upload their own avatars" ON storage.objects;
CREATE POLICY "Drivers can upload their own avatars" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'driver-avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Drivers can upload EOD screenshots" ON storage.objects;
CREATE POLICY "Drivers can upload EOD screenshots" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'eod-screenshots' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Drivers can view their own EOD screenshots" ON storage.objects;
CREATE POLICY "Drivers can view their own EOD screenshots" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'eod-screenshots' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Admins can view company EOD screenshots" ON storage.objects;
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

-- 6. Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_driver_profiles_company_id ON public.driver_profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_driver_profiles_user_id ON public.driver_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_eod_reports_driver_date ON public.eod_reports(driver_id, log_date);
CREATE INDEX IF NOT EXISTS idx_eod_reports_company_id ON public.eod_reports(company_id);
CREATE INDEX IF NOT EXISTS idx_profiles_company_user ON public.profiles(company_id, user_id);

-- 7. Remove unused functions
DROP FUNCTION IF EXISTS public.create_company_test(text, text, text, text);