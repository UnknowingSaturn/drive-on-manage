-- Secure storage policies and cleanup automation

-- 1. Remove public access from all storage buckets
UPDATE storage.buckets SET public = false WHERE id IN ('driver-documents', 'eod-screenshots');

-- 2. Create automated cleanup function for expired documents
CREATE OR REPLACE FUNCTION public.cleanup_expired_documents()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  cleanup_count integer;
  cutoff_date timestamp;
BEGIN
  -- Set cutoff date to 90 days ago
  cutoff_date := now() - interval '90 days';
  
  -- Log cleanup start
  RAISE NOTICE 'Starting document cleanup for files older than %', cutoff_date;
  
  -- Get count of files to be cleaned up
  SELECT COUNT(*) INTO cleanup_count
  FROM storage.objects 
  WHERE bucket_id IN ('driver-documents', 'eod-screenshots')
  AND created_at < cutoff_date;
  
  -- Only proceed if there are files to clean up
  IF cleanup_count > 0 THEN
    -- Delete old documents from storage
    DELETE FROM storage.objects 
    WHERE bucket_id IN ('driver-documents', 'eod-screenshots')
    AND created_at < cutoff_date;
    
    RAISE NOTICE 'Cleaned up % expired documents', cleanup_count;
    
    -- Log cleanup activity
    INSERT INTO public.cleanup_audit_log (
      cleanup_type,
      items_cleaned,
      cutoff_date,
      performed_at
    ) VALUES (
      'expired_documents',
      cleanup_count,
      cutoff_date,
      now()
    );
  ELSE
    RAISE NOTICE 'No expired documents found for cleanup';
  END IF;
END;
$$;

-- 3. Create audit log table for cleanup activities
CREATE TABLE IF NOT EXISTS public.cleanup_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cleanup_type text NOT NULL,
  items_cleaned integer NOT NULL DEFAULT 0,
  cutoff_date timestamp with time zone NOT NULL,
  performed_at timestamp with time zone NOT NULL DEFAULT now(),
  details jsonb DEFAULT '{}'::jsonb
);

-- Enable RLS on cleanup audit log
ALTER TABLE public.cleanup_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view cleanup logs
CREATE POLICY "Admins can view cleanup audit logs"
ON public.cleanup_audit_log FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND user_type = 'admin'
  )
);

-- 4. Create function to check document expiry and mark for cleanup
CREATE OR REPLACE FUNCTION public.mark_documents_for_cleanup()
RETURNS TABLE (
  file_path text,
  file_age_days integer,
  should_cleanup boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.name as file_path,
    EXTRACT(DAYS FROM (now() - o.created_at))::integer as file_age_days,
    (o.created_at < now() - interval '90 days') as should_cleanup
  FROM storage.objects o
  WHERE o.bucket_id IN ('driver-documents', 'eod-screenshots')
  ORDER BY o.created_at ASC;
END;
$$;

-- 5. Enhanced storage policies with stricter access control
DROP POLICY IF EXISTS "Secure file uploads with validation" ON storage.objects;
DROP POLICY IF EXISTS "Users view own files" ON storage.objects;
DROP POLICY IF EXISTS "Admins view company files" ON storage.objects;

-- Ultra-secure file upload policy
CREATE POLICY "Authenticated secure uploads only"
ON storage.objects FOR INSERT 
WITH CHECK (
  -- Must be authenticated
  auth.uid() IS NOT NULL AND
  
  -- Only specific buckets allowed
  bucket_id IN ('driver-documents', 'eod-screenshots', 'driver-avatars') AND
  
  -- File path must contain user ID and be properly formatted
  name ~ ('^' || auth.uid()::text || '/[a-zA-Z0-9_-]+/[a-zA-Z0-9._-]+\.(jpg|jpeg|png|pdf|doc|docx)$') AND
  
  -- File name length limits
  char_length(name) BETWEEN 20 AND 200 AND
  
  -- No directory traversal
  name !~ '\.\.' AND
  name !~ '//' AND
  
  -- File size validation through metadata
  COALESCE((metadata->>'size')::bigint, 0) BETWEEN 1 AND 10485760 AND
  
  -- MIME type validation
  COALESCE(metadata->>'mimetype', '') IN (
    'image/jpeg', 'image/png', 'image/jpg',
    'application/pdf', 
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  )
);

-- User file access policy
CREATE POLICY "Users access own files only"
ON storage.objects FOR SELECT
USING (
  auth.uid() IS NOT NULL AND
  bucket_id IN ('driver-documents', 'eod-screenshots', 'driver-avatars') AND
  name ~ ('^' || auth.uid()::text || '/') AND
  name !~ '\.\.'
);

-- Admin company file access policy
CREATE POLICY "Admins access company files securely"
ON storage.objects FOR SELECT
USING (
  auth.uid() IS NOT NULL AND
  bucket_id IN ('driver-documents', 'eod-screenshots') AND
  name !~ '\.\.' AND
  EXISTS (
    SELECT 1 FROM profiles p 
    JOIN driver_profiles dp ON dp.company_id = p.company_id
    WHERE p.user_id = auth.uid() 
    AND p.user_type = 'admin'
    AND name ~ ('^' || dp.user_id::text || '/')
  )
);

-- File deletion policy (only own files)
CREATE POLICY "Users can delete own files"
ON storage.objects FOR DELETE
USING (
  auth.uid() IS NOT NULL AND
  bucket_id IN ('driver-documents', 'eod-screenshots', 'driver-avatars') AND
  name ~ ('^' || auth.uid()::text || '/') AND
  name !~ '\.\.'
);

-- 6. Create real-time validation triggers
CREATE OR REPLACE FUNCTION public.validate_vehicle_assignment()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  existing_assignment uuid;
  vehicle_exists boolean;
BEGIN
  -- Check if this is an insert or update with van_id
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.van_id IS DISTINCT FROM OLD.van_id) THEN
    
    -- Skip validation if van_id is null
    IF NEW.van_id IS NULL THEN
      RETURN NEW;
    END IF;
    
    -- Check if vehicle exists
    SELECT EXISTS(SELECT 1 FROM vans WHERE id = NEW.van_id) INTO vehicle_exists;
    IF NOT vehicle_exists THEN
      RAISE EXCEPTION 'Vehicle with ID % does not exist', NEW.van_id;
    END IF;
    
    -- Check for existing assignment on the same date
    SELECT driver_id INTO existing_assignment
    FROM sod_logs 
    WHERE van_id = NEW.van_id 
    AND log_date = NEW.log_date 
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
    
    IF existing_assignment IS NOT NULL THEN
      RAISE EXCEPTION 'Vehicle % is already assigned to driver % for date %', 
        NEW.van_id, existing_assignment, NEW.log_date;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Apply vehicle assignment validation to SOD logs
CREATE TRIGGER validate_sod_vehicle_assignment
  BEFORE INSERT OR UPDATE ON sod_logs
  FOR EACH ROW
  EXECUTE FUNCTION validate_vehicle_assignment();

-- 7. Create duplicate entry prevention trigger
CREATE OR REPLACE FUNCTION public.prevent_duplicate_entries()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  entry_count integer;
  entry_type text;
BEGIN
  -- Determine entry type based on table
  IF TG_TABLE_NAME = 'sod_logs' THEN
    entry_type := 'SOD';
  ELSIF TG_TABLE_NAME = 'eod_reports' THEN
    entry_type := 'EOD';
  ELSE
    RETURN NEW;
  END IF;
  
  -- Check for existing entries on the same date
  IF TG_OP = 'INSERT' THEN
    EXECUTE format('SELECT COUNT(*) FROM %I WHERE driver_id = $1 AND log_date = $2', TG_TABLE_NAME)
    INTO entry_count
    USING NEW.driver_id, NEW.log_date;
    
    IF entry_count > 0 THEN
      RAISE EXCEPTION 'Driver % already has % entry for date %', 
        NEW.driver_id, entry_type, NEW.log_date;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Apply duplicate prevention to both SOD and EOD
CREATE TRIGGER prevent_duplicate_sod_entries
  BEFORE INSERT ON sod_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_duplicate_entries();

CREATE TRIGGER prevent_duplicate_eod_entries
  BEFORE INSERT ON eod_reports
  FOR EACH ROW
  EXECUTE FUNCTION prevent_duplicate_entries();

-- 8. Create parcel count validation trigger
CREATE OR REPLACE FUNCTION public.validate_parcel_counts()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  starting_count integer;
BEGIN
  -- Only validate on EOD entries
  IF TG_TABLE_NAME != 'eod_reports' THEN
    RETURN NEW;
  END IF;
  
  -- Get starting parcel count from SOD
  SELECT parcel_count INTO starting_count
  FROM sod_logs 
  WHERE driver_id = NEW.driver_id 
  AND log_date = NEW.log_date;
  
  IF starting_count IS NULL THEN
    RAISE EXCEPTION 'No SOD entry found for driver % on date %. Complete Start of Day first.', 
      NEW.driver_id, NEW.log_date;
  END IF;
  
  IF NEW.parcels_delivered > starting_count THEN
    RAISE EXCEPTION 'Delivered count (%) cannot exceed starting count (%)', 
      NEW.parcels_delivered, starting_count;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Apply parcel validation to EOD reports
CREATE TRIGGER validate_eod_parcel_counts
  BEFORE INSERT OR UPDATE ON eod_reports
  FOR EACH ROW
  EXECUTE FUNCTION validate_parcel_counts();

-- 9. Create indexes for real-time validation performance
CREATE INDEX IF NOT EXISTS idx_sod_logs_van_date ON sod_logs(van_id, log_date) WHERE van_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sod_logs_driver_date ON sod_logs(driver_id, log_date);
CREATE INDEX IF NOT EXISTS idx_eod_reports_driver_date ON eod_reports(driver_id, log_date);
CREATE INDEX IF NOT EXISTS idx_storage_objects_cleanup ON storage.objects(bucket_id, created_at) WHERE bucket_id IN ('driver-documents', 'eod-screenshots');