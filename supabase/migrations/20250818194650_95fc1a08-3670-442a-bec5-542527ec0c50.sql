-- Make the eod-screenshots bucket public so the edge function can access images
UPDATE storage.buckets 
SET public = true 
WHERE id = 'eod-screenshots';

-- Ensure there are proper policies for the eod-screenshots bucket
-- Allow public read access for the bucket
CREATE POLICY IF NOT EXISTS "Allow public read access for eod-screenshots" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'eod-screenshots');

-- Allow authenticated users to upload their own EOD screenshots
CREATE POLICY IF NOT EXISTS "Allow users to upload their own EOD screenshots" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'eod-screenshots' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to update their own EOD screenshots
CREATE POLICY IF NOT EXISTS "Allow users to update their own EOD screenshots" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'eod-screenshots' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to delete their own EOD screenshots
CREATE POLICY IF NOT EXISTS "Allow users to delete their own EOD screenshots" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'eod-screenshots' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);