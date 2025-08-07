-- Create storage policies for driver file uploads during onboarding
-- Allow public uploads to driver-documents bucket (onboarding users aren't authenticated yet)
CREATE POLICY "Allow public uploads during onboarding"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'driver-documents');

-- Allow public access to read uploaded documents (for verification)
CREATE POLICY "Allow public read access for onboarding documents"
ON storage.objects
FOR SELECT
USING (bucket_id = 'driver-documents');

-- Allow updates to uploaded documents during onboarding
CREATE POLICY "Allow public updates during onboarding"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'driver-documents');

-- Create similar policies for driver-avatars bucket
CREATE POLICY "Allow public avatar uploads during onboarding"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'driver-avatars');

CREATE POLICY "Allow public avatar read during onboarding"
ON storage.objects
FOR SELECT
USING (bucket_id = 'driver-avatars');

CREATE POLICY "Allow public avatar updates during onboarding"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'driver-avatars');