-- Fix existing data and add proper constraints

-- 1. Update any invalid status values to valid ones
UPDATE driver_invitations SET status = 'revoked' WHERE status = 'cancelled';
UPDATE driver_invitations SET status = 'pending' WHERE status NOT IN ('pending', 'accepted', 'expired', 'revoked');

-- Update any other invalid statuses in other tables
UPDATE driver_profiles SET status = 'pending' WHERE status NOT IN ('pending', 'active', 'inactive', 'suspended');
UPDATE eod_reports SET status = 'submitted' WHERE status NOT IN ('submitted', 'approved', 'rejected');
UPDATE incident_reports SET status = 'reported' WHERE status NOT IN ('reported', 'investigating', 'resolved', 'dismissed');
UPDATE payments SET status = 'calculated' WHERE status NOT IN ('calculated', 'approved', 'paid', 'disputed');
UPDATE vehicle_checks SET status = 'completed' WHERE status NOT IN ('completed', 'issues_found', 'failed');

-- Fix any negative values
UPDATE eod_reports SET parcels_delivered = 0 WHERE parcels_delivered < 0;
UPDATE sod_logs SET parcel_count = 0 WHERE parcel_count < 0;
UPDATE sod_logs SET starting_mileage = 0 WHERE starting_mileage < 0;
UPDATE vehicle_checks SET fuel_level = 0 WHERE fuel_level < 0;
UPDATE vehicle_checks SET mileage = 0 WHERE mileage < 0;
UPDATE payments SET total_pay = 0 WHERE total_pay < 0;
UPDATE payments SET parcel_rate = 0 WHERE parcel_rate < 0;
UPDATE payments SET parcel_count = 0 WHERE parcel_count < 0;
UPDATE driver_invitations SET hourly_rate = 0 WHERE hourly_rate < 0;
UPDATE driver_profiles SET hourly_rate = 0 WHERE hourly_rate < 0;
UPDATE driver_profiles SET parcel_rate = 0 WHERE parcel_rate < 0;

-- 2. Now add the validation constraints
ALTER TABLE driver_invitations
ADD CONSTRAINT chk_invitation_status CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
ADD CONSTRAINT chk_invitation_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
ADD CONSTRAINT chk_invitation_phone_format CHECK (phone IS NULL OR phone ~* '^\+?[1-9]\d{1,14}$'),
ADD CONSTRAINT chk_invitation_hourly_rate CHECK (hourly_rate IS NULL OR hourly_rate >= 0);

ALTER TABLE driver_profiles
ADD CONSTRAINT chk_driver_status CHECK (status IN ('pending', 'active', 'inactive', 'suspended')),
ADD CONSTRAINT chk_driver_hourly_rate CHECK (hourly_rate IS NULL OR hourly_rate >= 0),
ADD CONSTRAINT chk_driver_parcel_rate CHECK (parcel_rate IS NULL OR parcel_rate >= 0);

ALTER TABLE eod_reports
ADD CONSTRAINT chk_eod_status CHECK (status IN ('submitted', 'approved', 'rejected')),
ADD CONSTRAINT chk_eod_parcels_delivered CHECK (parcels_delivered >= 0),
ADD CONSTRAINT chk_eod_pay_amounts CHECK (
  (estimated_pay IS NULL OR estimated_pay >= 0) AND 
  (actual_pay IS NULL OR actual_pay >= 0)
);

ALTER TABLE incident_reports
ADD CONSTRAINT chk_incident_status CHECK (status IN ('reported', 'investigating', 'resolved', 'dismissed')),
ADD CONSTRAINT chk_incident_type CHECK (incident_type IN ('accident', 'theft', 'damage', 'safety', 'other'));

ALTER TABLE payments
ADD CONSTRAINT chk_payment_status CHECK (status IN ('calculated', 'approved', 'paid', 'disputed')),
ADD CONSTRAINT chk_payment_amounts CHECK (
  total_pay >= 0 AND 
  parcel_rate >= 0 AND 
  parcel_count >= 0 AND
  (base_pay IS NULL OR base_pay >= 0)
);

ALTER TABLE sod_logs
ADD CONSTRAINT chk_sod_parcel_count CHECK (parcel_count >= 0),
ADD CONSTRAINT chk_sod_mileage CHECK (starting_mileage >= 0);

ALTER TABLE vehicle_checks
ADD CONSTRAINT chk_vehicle_fuel_level CHECK (fuel_level IS NULL OR (fuel_level >= 0 AND fuel_level <= 100)),
ADD CONSTRAINT chk_vehicle_mileage CHECK (mileage IS NULL OR mileage >= 0),
ADD CONSTRAINT chk_vehicle_status CHECK (status IN ('completed', 'issues_found', 'failed'));

-- 3. Add missing foreign key constraints with proper checks
DO $$
BEGIN
    -- Daily logs constraints
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_daily_logs_company') THEN
        ALTER TABLE daily_logs ADD CONSTRAINT fk_daily_logs_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_daily_logs_driver') THEN
        ALTER TABLE daily_logs ADD CONSTRAINT fk_daily_logs_driver FOREIGN KEY (driver_id) REFERENCES driver_profiles(id) ON DELETE CASCADE;
    END IF;

    -- Driver invitations constraints  
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_driver_invitations_company') THEN
        ALTER TABLE driver_invitations ADD CONSTRAINT fk_driver_invitations_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_driver_invitations_created_by') THEN
        ALTER TABLE driver_invitations ADD CONSTRAINT fk_driver_invitations_created_by FOREIGN KEY (created_by) REFERENCES profiles(user_id) ON DELETE CASCADE;
    END IF;

    -- EOD reports constraints
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_eod_reports_company') THEN
        ALTER TABLE eod_reports ADD CONSTRAINT fk_eod_reports_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_eod_reports_driver') THEN
        ALTER TABLE eod_reports ADD CONSTRAINT fk_eod_reports_driver FOREIGN KEY (driver_id) REFERENCES driver_profiles(id) ON DELETE CASCADE;
    END IF;

    -- Vehicle checks constraints
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_vehicle_checks_van') THEN
        ALTER TABLE vehicle_checks ADD CONSTRAINT fk_vehicle_checks_van FOREIGN KEY (van_id) REFERENCES vans(id) ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_vehicle_checks_driver') THEN
        ALTER TABLE vehicle_checks ADD CONSTRAINT fk_vehicle_checks_driver FOREIGN KEY (driver_id) REFERENCES driver_profiles(id) ON DELETE CASCADE;
    END IF;
END
$$;

-- 4. Enhanced RLS policies
DROP POLICY IF EXISTS "Public can view invitations by token for onboarding" ON driver_invitations;

CREATE POLICY "Secure invitation access by token"
ON driver_invitations FOR SELECT
USING (
  auth.uid() IS NOT NULL AND
  status = 'pending' AND
  expires_at > now() AND
  char_length(invite_token) > 10
);

-- 5. Secure file upload validation function
CREATE OR REPLACE FUNCTION public.validate_secure_file_upload(
  file_name text,
  file_size bigint,
  content_type text,
  user_folder text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Validate file extension
  IF NOT (file_name ~* '\.(jpg|jpeg|png|pdf|doc|docx)$') THEN
    RETURN false;
  END IF;
  
  -- Check file size (max 10MB)
  IF file_size > 10485760 THEN
    RETURN false;
  END IF;
  
  -- Validate MIME type
  IF content_type NOT IN (
    'image/jpeg', 'image/png', 'image/jpg',
    'application/pdf', 
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) THEN
    RETURN false;
  END IF;
  
  -- Validate user folder (prevent directory traversal)
  IF user_folder ~ '\.\.' OR user_folder ~ '/' OR char_length(user_folder) != 36 THEN
    RETURN false;
  END IF;
  
  -- Validate filename length and characters
  IF char_length(file_name) > 100 OR file_name ~ '[<>:"/\\|?*]' THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$;

-- 6. Enhanced storage policies
DROP POLICY IF EXISTS "Secure driver document uploads" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own driver documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view company driver documents" ON storage.objects;

CREATE POLICY "Secure validated file uploads"
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id IN ('driver-documents', 'eod-screenshots', 'driver-avatars') AND
  auth.uid() IS NOT NULL AND
  auth.uid()::text = (storage.foldername(name))[1] AND
  char_length(name) < 200 AND
  name !~ '\.\.' AND
  public.validate_secure_file_upload(
    (storage.filename(name))[1], 
    COALESCE((metadata->>'size')::bigint, 0), 
    COALESCE(metadata->>'mimetype', ''), 
    (storage.foldername(name))[1]
  )
);

CREATE POLICY "Users access own documents securely"
ON storage.objects FOR SELECT
USING (
  bucket_id IN ('driver-documents', 'eod-screenshots', 'driver-avatars') AND
  auth.uid()::text = (storage.foldername(name))[1] AND
  name !~ '\.\.'
);

CREATE POLICY "Admins access company documents securely"
ON storage.objects FOR SELECT
USING (
  bucket_id IN ('driver-documents', 'eod-screenshots') AND
  name !~ '\.\.' AND
  EXISTS (
    SELECT 1 FROM profiles p 
    JOIN driver_profiles dp ON dp.company_id = p.company_id
    WHERE p.user_id = auth.uid() 
    AND p.user_type = 'admin'
    AND dp.user_id::text = (storage.foldername(name))[1]
  )
);

-- 7. Add performance indexes
CREATE INDEX IF NOT EXISTS idx_daily_logs_driver_date ON daily_logs(driver_id, log_date);
CREATE INDEX IF NOT EXISTS idx_driver_invitations_token ON driver_invitations(invite_token);
CREATE INDEX IF NOT EXISTS idx_driver_invitations_email ON driver_invitations(email);
CREATE INDEX IF NOT EXISTS idx_eod_reports_driver_date ON eod_reports(driver_id, log_date);
CREATE INDEX IF NOT EXISTS idx_incident_reports_driver_date ON incident_reports(driver_id, incident_date);
CREATE INDEX IF NOT EXISTS idx_payments_driver_period ON payments(driver_id, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_schedules_driver_date ON schedules(driver_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_sod_logs_driver_date ON sod_logs(driver_id, log_date);