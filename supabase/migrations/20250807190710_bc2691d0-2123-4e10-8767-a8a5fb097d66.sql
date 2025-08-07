-- Fix the security warning by setting proper search path
CREATE OR REPLACE FUNCTION public.calculate_driver_pay(
  driver_id_param UUID,
  parcel_count_param INTEGER,
  base_pay_param NUMERIC DEFAULT 0
) RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  driver_parcel_rate NUMERIC;
  total_pay NUMERIC;
BEGIN
  -- Get driver's parcel rate
  SELECT parcel_rate INTO driver_parcel_rate
  FROM driver_profiles
  WHERE id = driver_id_param;
  
  -- Calculate total pay: base pay + (parcel count * parcel rate)
  total_pay := COALESCE(base_pay_param, 0) + (parcel_count_param * COALESCE(driver_parcel_rate, 0));
  
  RETURN total_pay;
END;
$$;