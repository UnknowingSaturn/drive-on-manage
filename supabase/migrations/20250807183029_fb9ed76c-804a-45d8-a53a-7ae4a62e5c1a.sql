-- Drop existing conflicting constraint and add the correct one
ALTER TABLE driver_invitations DROP CONSTRAINT IF EXISTS driver_invitations_status_check;
ALTER TABLE driver_invitations DROP CONSTRAINT IF EXISTS chk_invitation_status;

-- Add the correct constraint that includes all valid statuses
ALTER TABLE driver_invitations
ADD CONSTRAINT chk_invitation_status CHECK (status IN ('pending', 'accepted', 'expired', 'revoked', 'cancelled'));

-- Add other validation constraints
ALTER TABLE driver_invitations
ADD CONSTRAINT chk_invitation_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
ADD CONSTRAINT chk_invitation_phone_format CHECK (phone IS NULL OR phone ~* '^\+?[1-9]\d{1,14}$'),
ADD CONSTRAINT chk_invitation_hourly_rate CHECK (hourly_rate IS NULL OR hourly_rate >= 0);

-- Test the foreign key joins to ensure they work correctly
CREATE OR REPLACE VIEW public.test_foreign_key_joins AS
SELECT 
  'eod_reports_to_driver_profiles' as test_name,
  COUNT(*) as total_records,
  COUNT(dp.id) as valid_joins,
  COUNT(*) - COUNT(dp.id) as orphaned_records
FROM eod_reports eod
LEFT JOIN driver_profiles dp ON eod.driver_id = dp.id

UNION ALL

SELECT 
  'daily_logs_to_driver_profiles' as test_name,
  COUNT(*) as total_records,
  COUNT(dp.id) as valid_joins,
  COUNT(*) - COUNT(dp.id) as orphaned_records
FROM daily_logs dl
LEFT JOIN driver_profiles dp ON dl.driver_id = dp.id

UNION ALL

SELECT 
  'driver_profiles_to_companies' as test_name,
  COUNT(*) as total_records,
  COUNT(c.id) as valid_joins,
  COUNT(*) - COUNT(c.id) as orphaned_records
FROM driver_profiles dp
LEFT JOIN companies c ON dp.company_id = c.id

UNION ALL

SELECT 
  'payments_to_eod_reports' as test_name,
  COUNT(*) as total_records,
  COUNT(eod.id) as valid_joins,
  COUNT(*) - COUNT(eod.id) as orphaned_records
FROM payments p
LEFT JOIN eod_reports eod ON p.eod_report_id = eod.id;

-- Enhanced RLS policies with better security
DROP POLICY IF EXISTS "Public can view invitations by token for onboarding" ON driver_invitations;
DROP POLICY IF EXISTS "Authenticated users can view valid invitations by token" ON driver_invitations;

CREATE POLICY "Secure invitation token access"
ON driver_invitations FOR SELECT
USING (
  auth.uid() IS NOT NULL AND
  status IN ('pending', 'accepted') AND
  expires_at > now() AND
  char_length(invite_token) >= 32 AND
  invite_token ~ '^[A-Za-z0-9_-]+$'
);

-- Add rate limiting for invitation creation
CREATE OR REPLACE FUNCTION public.check_invitation_rate_limit(admin_user_id uuid, company_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  recent_invites integer;
BEGIN
  -- Check invitations in last hour
  SELECT COUNT(*) INTO recent_invites
  FROM driver_invitations
  WHERE created_by = admin_user_id
  AND created_at > now() - interval '1 hour';
  
  -- Allow max 10 invitations per hour
  RETURN recent_invites < 10;
END;
$$;

-- Secure file upload validation with enhanced checks
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
  -- Validate file extension (case insensitive)
  IF NOT (lower(file_name) ~* '\.(jpg|jpeg|png|pdf|doc|docx)$') THEN
    RETURN false;
  END IF;
  
  -- Check file size (max 10MB)
  IF file_size > 10485760 OR file_size <= 0 THEN
    RETURN false;
  END IF;
  
  -- Validate MIME type strictly
  IF content_type NOT IN (
    'image/jpeg', 'image/png', 'image/jpg',
    'application/pdf', 
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) THEN
    RETURN false;
  END IF;
  
  -- Validate user folder format (UUID)
  IF user_folder !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN false;
  END IF;
  
  -- Validate filename (no special characters, reasonable length)
  IF char_length(file_name) > 100 OR char_length(file_name) < 1 THEN
    RETURN false;
  END IF;
  
  -- Check for dangerous characters
  IF file_name ~ '[<>:"/\\|?*\x00-\x1f]' THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$;

-- Enhanced storage policies with path validation
DROP POLICY IF EXISTS "Secure driver document uploads" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload to their own driver document folder" ON storage.objects;
DROP POLICY IF EXISTS "Secure validated file uploads" ON storage.objects;

CREATE POLICY "Ultra secure file uploads"
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id IN ('driver-documents', 'eod-screenshots', 'driver-avatars') AND
  auth.uid() IS NOT NULL AND
  auth.uid()::text = (storage.foldername(name))[1] AND
  char_length(name) BETWEEN 10 AND 200 AND
  name !~ '\.\.|//|\\' AND
  name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/' AND
  public.validate_secure_file_upload(
    (storage.filename(name))[1], 
    COALESCE((metadata->>'size')::bigint, 0), 
    COALESCE(metadata->>'mimetype', ''), 
    (storage.foldername(name))[1]
  )
);

-- Add comprehensive indexes for performance
CREATE INDEX IF NOT EXISTS idx_driver_invitations_status_expires ON driver_invitations(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_driver_profiles_status_company ON driver_profiles(status, company_id);
CREATE INDEX IF NOT EXISTS idx_eod_reports_status_company ON eod_reports(status, company_id, log_date);
CREATE INDEX IF NOT EXISTS idx_payments_status_period ON payments(status, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_storage_security ON storage.objects(bucket_id, name) WHERE bucket_id IN ('driver-documents', 'eod-screenshots', 'driver-avatars');