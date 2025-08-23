-- Update handle_new_user function to use role from app metadata
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Get role from raw_app_meta_data, fallback to raw_user_meta_data, then default to 'driver'
  DECLARE
    user_role TEXT;
    company_ids UUID[];
  BEGIN
    -- Extract role from app metadata (set by admin invite) or user metadata
    user_role := COALESCE(
      NEW.raw_app_meta_data ->> 'role',
      NEW.raw_user_meta_data ->> 'user_type',
      NEW.raw_user_meta_data ->> 'role',
      'driver'
    );

    -- Extract company IDs from app metadata
    IF NEW.raw_app_meta_data ? 'company_ids' THEN
      company_ids := ARRAY(SELECT jsonb_array_elements_text(NEW.raw_app_meta_data->'company_ids'))::UUID[];
    END IF;

    -- Insert profile with role
    INSERT INTO public.profiles (
      user_id, 
      email, 
      first_name, 
      last_name, 
      user_type
    )
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_app_meta_data ->> 'first_name', NEW.raw_user_meta_data ->> 'first_name'),
      COALESCE(NEW.raw_app_meta_data ->> 'last_name', NEW.raw_user_meta_data ->> 'last_name'),
      user_role
    );

    -- Create user-company associations if company IDs provided
    IF company_ids IS NOT NULL AND array_length(company_ids, 1) > 0 THEN
      INSERT INTO public.user_companies (user_id, company_id, role)
      SELECT NEW.id, unnest(company_ids), user_role;
    END IF;

    RETURN NEW;
  END;
END;
$$;

-- Recreate trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();