-- First, create a company for the admin user if one doesn't exist
DO $$
DECLARE
    admin_user_id uuid := '3fc0f436-6d21-41f9-af5d-5048c590220d';
    new_company_id uuid;
BEGIN
    -- Insert a new company
    INSERT INTO public.companies (name, email, address, phone, subscription_tier, is_active)
    VALUES ('Default Company', 'saturn.finance.mm@gmail.com', 'UK', '+44 123 456 7890', 'basic', true)
    RETURNING id INTO new_company_id;
    
    -- Update the admin user's profile to have this company_id
    UPDATE public.profiles 
    SET company_id = new_company_id, updated_at = now()
    WHERE user_id = admin_user_id;
    
    RAISE NOTICE 'Created company with ID: % and updated profile', new_company_id;
END $$;