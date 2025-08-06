-- Create storage buckets for driver documents
INSERT INTO storage.buckets (id, name, public) VALUES 
  ('driver-documents', 'driver-documents', false),
  ('driver-avatars', 'driver-avatars', true);

-- Create driver invitations table with secure tokens
CREATE TABLE public.driver_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  hourly_rate NUMERIC,
  company_id UUID NOT NULL,
  invite_token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days'),
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  driver_profile_id UUID
);

-- Enable RLS on driver invitations
ALTER TABLE public.driver_invitations ENABLE ROW LEVEL SECURITY;

-- Create policies for driver invitations
CREATE POLICY "Admins can manage invitations in their company" 
ON public.driver_invitations 
FOR ALL 
USING (company_id IN (
  SELECT profiles.company_id 
  FROM profiles 
  WHERE profiles.user_id = auth.uid() AND profiles.user_type = 'admin'
));

-- Create function to generate secure invite tokens
CREATE OR REPLACE FUNCTION public.generate_invite_token()
RETURNS TEXT AS $$
BEGIN
  RETURN encode(gen_random_bytes(32), 'base64url');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create storage policies for driver documents
CREATE POLICY "Users can upload their own documents" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'driver-documents' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own documents" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'driver-documents' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Admins can view company driver documents" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'driver-documents' AND 
  EXISTS (
    SELECT 1 FROM driver_profiles dp
    JOIN profiles p ON dp.user_id = (storage.foldername(name))[1]::uuid
    WHERE dp.company_id IN (
      SELECT company_id FROM profiles 
      WHERE user_id = auth.uid() AND user_type = 'admin'
    )
  )
);

-- Create storage policies for driver avatars
CREATE POLICY "Anyone can view driver avatars" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'driver-avatars');

CREATE POLICY "Users can upload their own avatar" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'driver-avatars' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own avatar" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'driver-avatars' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Add onboarding completion tracking to driver_profiles
ALTER TABLE public.driver_profiles ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.driver_profiles ADD COLUMN IF NOT EXISTS onboarding_progress JSONB DEFAULT '{}';
ALTER TABLE public.driver_profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Update function for tracking onboarding progress
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add trigger for driver_invitations
CREATE TRIGGER update_driver_invitations_updated_at
  BEFORE UPDATE ON public.driver_invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();