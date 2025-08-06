-- Add updated_at column to driver_invitations table
ALTER TABLE public.driver_invitations 
ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();

-- Create trigger for automatic timestamp updates on driver_invitations
CREATE TRIGGER update_driver_invitations_updated_at
BEFORE UPDATE ON public.driver_invitations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();