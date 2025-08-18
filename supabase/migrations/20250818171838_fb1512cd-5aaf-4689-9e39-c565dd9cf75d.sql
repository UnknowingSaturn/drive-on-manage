-- Make the sod-screenshots bucket public for Google Vision API access
UPDATE storage.buckets 
SET public = true 
WHERE id = 'sod-screenshots';

-- Update the bucket policy to allow public read access for Google Vision API
CREATE POLICY "Public read access for sod-screenshots" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'sod-screenshots');