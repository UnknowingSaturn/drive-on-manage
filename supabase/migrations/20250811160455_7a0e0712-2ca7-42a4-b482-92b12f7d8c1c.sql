-- Drop the remaining storage policies that depend on profiles.company_id
DROP POLICY IF EXISTS "Admins can view company driver documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view EOD screenshots in their company" ON storage.objects;

-- Now we can safely remove company_id from profiles table
ALTER TABLE public.profiles DROP COLUMN company_id;

-- Add updated_at trigger for user_companies
CREATE TRIGGER update_user_companies_updated_at
BEFORE UPDATE ON public.user_companies
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();