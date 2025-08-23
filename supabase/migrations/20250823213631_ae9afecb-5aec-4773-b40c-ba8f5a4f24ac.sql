-- Fix the missing user_companies entry for the Assistant admin user
INSERT INTO user_companies (user_id, company_id, role)
VALUES ('80c0a684-4071-43fd-a04a-735a271f7f88', '6fddb8b3-d158-4217-9917-72920c7f3646', 'supervisor')
ON CONFLICT (user_id, company_id) DO NOTHING;

-- Check and fix the handle_new_user trigger to be more robust
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

  -- Insert profile with role (with conflict handling)
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
  )
  ON CONFLICT (user_id) DO UPDATE SET
    email = EXCLUDED.email,
    first_name = COALESCE(EXCLUDED.first_name, profiles.first_name),
    last_name = COALESCE(EXCLUDED.last_name, profiles.last_name),
    user_type = EXCLUDED.user_type;

  -- Create user-company associations if company IDs provided
  IF company_ids IS NOT NULL AND array_length(company_ids, 1) > 0 THEN
    INSERT INTO public.user_companies (user_id, company_id, role)
    SELECT NEW.id, unnest(company_ids), user_role
    ON CONFLICT (user_id, company_id) DO UPDATE SET
      role = EXCLUDED.role;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the user creation
    RAISE WARNING 'Error in handle_new_user trigger: %', SQLERRM;
    RETURN NEW;
END;
$$;