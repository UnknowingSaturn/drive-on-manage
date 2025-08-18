-- Make the sod-screenshots bucket public again for Google Vision API access
UPDATE storage.buckets 
SET public = true 
WHERE id = 'sod-screenshots';

-- Add back the public read access policy for Google Vision API
CREATE POLICY "Public read access for sod-screenshots" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'sod-screenshots');