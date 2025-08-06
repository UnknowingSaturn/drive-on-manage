-- Add updated_at column to driver_invitations table
ALTER TABLE public.driver_invitations 
ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();