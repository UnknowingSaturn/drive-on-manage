-- Add missing foreign key constraints (check if exists first)

-- Add constraints that don't exist yet
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

    -- Driver profiles constraints
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_driver_profiles_company') THEN
        ALTER TABLE driver_profiles ADD CONSTRAINT fk_driver_profiles_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
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

-- Add validation constraints for security
DO $$
BEGIN
    -- Driver invitations validation
    IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'chk_invitation_status') THEN
        ALTER TABLE driver_invitations ADD CONSTRAINT chk_invitation_status CHECK (status IN ('pending', 'accepted', 'expired', 'revoked'));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'chk_invitation_email_format') THEN
        ALTER TABLE driver_invitations ADD CONSTRAINT chk_invitation_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');
    END IF;
    
    -- EOD reports validation
    IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'chk_eod_parcels_delivered') THEN
        ALTER TABLE eod_reports ADD CONSTRAINT chk_eod_parcels_delivered CHECK (parcels_delivered >= 0);
    END IF;
    
    -- SOD logs validation
    IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'chk_sod_parcel_count') THEN
        ALTER TABLE sod_logs ADD CONSTRAINT chk_sod_parcel_count CHECK (parcel_count >= 0);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'chk_sod_mileage') THEN
        ALTER TABLE sod_logs ADD CONSTRAINT chk_sod_mileage CHECK (starting_mileage >= 0);
    END IF;
END
$$;

-- Improve RLS policies for better security
DROP POLICY IF EXISTS "Public can view invitations by token for onboarding" ON driver_invitations;

CREATE POLICY "Authenticated users can view valid invitations by token"
ON driver_invitations FOR SELECT
USING (
  auth.uid() IS NOT NULL AND
  status = 'pending' AND
  expires_at > now()
);

-- Add secure file upload validation function
CREATE OR REPLACE FUNCTION public.validate_file_upload(
  file_name text,
  file_size bigint,
  content_type text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check file extension
  IF NOT (file_name ~* '\.(jpg|jpeg|png|pdf|doc|docx)$') THEN
    RETURN false;
  END IF;
  
  -- Check file size (max 10MB)
  IF file_size > 10485760 THEN
    RETURN false;
  END IF;
  
  -- Check MIME type
  IF content_type NOT IN (
    'image/jpeg', 'image/png', 'image/jpg',
    'application/pdf', 
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$;

-- Secure storage policies with file validation
DROP POLICY IF EXISTS "Users can upload to their own driver document folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own driver documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view driver documents in their company" ON storage.objects;

CREATE POLICY "Secure driver document uploads"
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'driver-documents' AND
  auth.uid() IS NOT NULL AND
  auth.uid()::text = (storage.foldername(name))[1] AND
  char_length(name) < 200 AND
  public.validate_file_upload(name, metadata->>'size', metadata->>'mimetype')
);

CREATE POLICY "Users can view their own driver documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'driver-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Admins can view company driver documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'driver-documents' AND
  EXISTS (
    SELECT 1 FROM profiles p 
    JOIN driver_profiles dp ON dp.company_id = p.company_id
    WHERE p.user_id = auth.uid() 
    AND p.user_type = 'admin'
    AND dp.user_id::text = (storage.foldername(name))[1]
  )
);

-- Add performance indexes
CREATE INDEX IF NOT EXISTS idx_daily_logs_driver_date ON daily_logs(driver_id, log_date);
CREATE INDEX IF NOT EXISTS idx_driver_invitations_token ON driver_invitations(invite_token);
CREATE INDEX IF NOT EXISTS idx_eod_reports_driver_date ON eod_reports(driver_id, log_date);