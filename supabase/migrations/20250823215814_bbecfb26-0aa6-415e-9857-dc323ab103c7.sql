-- Fix Function Search Path Issues (without dropping)
-- Update functions to have proper search_path set for security

-- Fix update_updated_at_column function (with proper search path)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix update_shift_updated_at function  
CREATE OR REPLACE FUNCTION public.update_shift_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix calculate_eod_total_parcels function
CREATE OR REPLACE FUNCTION public.calculate_eod_total_parcels()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.total_parcels = COALESCE(NEW.successful_deliveries, 0) + COALESCE(NEW.successful_collections, 0);
  RETURN NEW;
END;
$$;

-- Fix set_driver_password function
CREATE OR REPLACE FUNCTION public.set_driver_password(user_email text, new_password text)
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Update the user's password in auth.users
  UPDATE auth.users 
  SET encrypted_password = crypt(new_password, gen_salt('bf'))
  WHERE email = user_email;
END;
$$;