-- Revert the sod-screenshots bucket back to private since we're using base64 instead of URLs
UPDATE storage.buckets 
SET public = false 
WHERE id = 'sod-screenshots';

-- Remove the public read access policy since bucket is now private
DROP POLICY IF EXISTS "Public read access for sod-screenshots" ON storage.objects;