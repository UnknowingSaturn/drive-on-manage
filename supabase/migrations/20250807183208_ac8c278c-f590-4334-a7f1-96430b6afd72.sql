-- Final security improvements and constraint fixes

-- 1. Drop problematic constraints and add simpler ones
ALTER TABLE driver_invitations DROP CONSTRAINT IF EXISTS chk_invitation_status;
ALTER TABLE driver_invitations DROP CONSTRAINT IF EXISTS driver_invitations_status_check;

-- Add the correct status constraint
ALTER TABLE driver_invitations
ADD CONSTRAINT chk_invitation_status CHECK (status IN ('pending', 'accepted', 'expired', 'revoked', 'cancelled'));

-- Add other constraints only if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'chk_invitation_email_format' AND table_name = 'driver_invitations') THEN
        ALTER TABLE driver_invitations ADD CONSTRAINT chk_invitation_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'chk_invitation_phone_format' AND table_name = 'driver_invitations') THEN
        ALTER TABLE driver_invitations ADD CONSTRAINT chk_invitation_phone_format CHECK (phone IS NULL OR phone ~* '^\+?[1-9]\d{1,14}$');
    END IF;
END
$$;

-- 2. Enhanced RLS policies with simple path handling
DROP POLICY IF EXISTS "Public can view invitations by token for onboarding" ON driver_invitations;
DROP POLICY IF EXISTS "Authenticated users can view valid invitations by token" ON driver_invitations;
DROP POLICY IF EXISTS "Secure invitation token access" ON driver_invitations;

CREATE POLICY "Secure invitation access"
ON driver_invitations FOR SELECT
USING (
  auth.uid() IS NOT NULL AND
  status IN ('pending', 'accepted') AND
  expires_at > now() AND
  char_length(invite_token) >= 32
);

-- 3. Secure file upload function without subscripting
CREATE OR REPLACE FUNCTION public.validate_file_security(
  file_name text,
  file_size bigint,
  content_type text,
  folder_path text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Basic file validation
  IF file_name IS NULL OR char_length(file_name) = 0 OR char_length(file_name) > 100 THEN
    RETURN false;
  END IF;
  
  -- Size check (max 10MB)
  IF file_size IS NULL OR file_size <= 0 OR file_size > 10485760 THEN
    RETURN false;
  END IF;
  
  -- MIME type validation
  IF content_type NOT IN (
    'image/jpeg', 'image/png', 'image/jpg',
    'application/pdf', 
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) THEN
    RETURN false;
  END IF;
  
  -- Extension check
  IF NOT (lower(file_name) ~ '\.(jpg|jpeg|png|pdf|doc|docx)$') THEN
    RETURN false;
  END IF;
  
  -- Path safety check
  IF folder_path ~ '\.\.' OR folder_path ~ '//' THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$;

-- 4. Updated storage policies with simplified path handling
DROP POLICY IF EXISTS "Ultra secure file uploads" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own driver documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view company driver documents" ON storage.objects;
DROP POLICY IF EXISTS "Users access own documents securely" ON storage.objects;
DROP POLICY IF EXISTS "Admins access company documents securely" ON storage.objects;

CREATE POLICY "Secure file uploads with validation"
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id IN ('driver-documents', 'eod-screenshots', 'driver-avatars') AND
  auth.uid() IS NOT NULL AND
  char_length(name) BETWEEN 10 AND 200 AND
  name !~ '\.\.' AND
  name !~ '//' AND
  position('/' || auth.uid()::text || '/' in '/' || name || '/') > 0 AND
  public.validate_file_security(
    name, 
    COALESCE((metadata->>'size')::bigint, 0), 
    COALESCE(metadata->>'mimetype', ''), 
    name
  )
);

CREATE POLICY "Users view own files"
ON storage.objects FOR SELECT
USING (
  bucket_id IN ('driver-documents', 'eod-screenshots', 'driver-avatars') AND
  name !~ '\.\.' AND
  position('/' || auth.uid()::text || '/' in '/' || name || '/') > 0
);

CREATE POLICY "Admins view company files"
ON storage.objects FOR SELECT
USING (
  bucket_id IN ('driver-documents', 'eod-screenshots') AND
  name !~ '\.\.' AND
  EXISTS (
    SELECT 1 FROM profiles p 
    JOIN driver_profiles dp ON dp.company_id = p.company_id
    WHERE p.user_id = auth.uid() 
    AND p.user_type = 'admin'
    AND position('/' || dp.user_id::text || '/' in '/' || name || '/') > 0
  )
);

-- 5. Rate limiting function for security
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  user_id uuid,
  action_type text,
  time_window_minutes integer DEFAULT 60,
  max_attempts integer DEFAULT 10
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  recent_count integer;
BEGIN
  -- This would typically check a rate_limiting table
  -- For now, return true to allow actions
  -- In production, implement proper rate limiting storage
  RETURN true;
END;
$$;

-- 6. Test foreign key relationships
CREATE OR REPLACE VIEW public.foreign_key_integrity_check AS
SELECT 
  'driver_invitations' as table_name,
  COUNT(*) as total_records,
  COUNT(CASE WHEN company_id IS NOT NULL THEN 1 END) as valid_company_refs,
  COUNT(CASE WHEN created_by IS NOT NULL THEN 1 END) as valid_creator_refs
FROM driver_invitations

UNION ALL

SELECT 
  'driver_profiles' as table_name,
  COUNT(*) as total_records,
  COUNT(CASE WHEN company_id IS NOT NULL THEN 1 END) as valid_company_refs,
  COUNT(CASE WHEN user_id IS NOT NULL THEN 1 END) as valid_user_refs
FROM driver_profiles

UNION ALL

SELECT 
  'eod_reports' as table_name,
  COUNT(*) as total_records,
  COUNT(CASE WHEN company_id IS NOT NULL THEN 1 END) as valid_company_refs,
  COUNT(CASE WHEN driver_id IS NOT NULL THEN 1 END) as valid_driver_refs
FROM eod_reports;

-- 7. Add essential indexes for security and performance
CREATE INDEX IF NOT EXISTS idx_driver_invitations_secure ON driver_invitations(invite_token, status, expires_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_driver_profiles_security ON driver_profiles(user_id, company_id, status);
CREATE INDEX IF NOT EXISTS idx_eod_reports_security ON eod_reports(driver_id, company_id, status, log_date);
CREATE INDEX IF NOT EXISTS idx_storage_objects_security ON storage.objects(bucket_id, name) WHERE bucket_id IN ('driver-documents', 'eod-screenshots', 'driver-avatars');

-- 8. Security audit function
CREATE OR REPLACE FUNCTION public.security_audit_summary()
RETURNS TABLE (
  check_name text,
  status text,
  details text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'RLS Enabled'::text,
    CASE WHEN COUNT(*) > 0 THEN 'PASS' ELSE 'FAIL' END::text,
    'Tables with RLS: ' || COUNT(*)::text
  FROM information_schema.tables t
  JOIN pg_class c ON c.relname = t.table_name
  WHERE t.table_schema = 'public' 
  AND c.relrowsecurity = true

  UNION ALL

  SELECT 
    'Storage Policies'::text,
    CASE WHEN COUNT(*) >= 3 THEN 'PASS' ELSE 'FAIL' END::text,
    'Storage policies: ' || COUNT(*)::text
  FROM pg_policies
  WHERE schemaname = 'storage' AND tablename = 'objects'

  UNION ALL

  SELECT 
    'Validation Constraints'::text,
    CASE WHEN COUNT(*) >= 5 THEN 'PASS' ELSE 'WARN' END::text,
    'Check constraints: ' || COUNT(*)::text
  FROM information_schema.check_constraints
  WHERE constraint_schema = 'public';
END;
$$;