-- Ensure eod-screenshots bucket has proper RLS policies for public access like sod-screenshots
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('eod-screenshots', 'eod-screenshots', true, 52428800, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET 
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- Create storage policies for EOD screenshots to match SOD screenshots
CREATE POLICY "EOD screenshots are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'eod-screenshots');

CREATE POLICY "Drivers can upload their own EOD screenshots" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'eod-screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Drivers can update their own EOD screenshots" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'eod-screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Drivers can delete their own EOD screenshots" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'eod-screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);