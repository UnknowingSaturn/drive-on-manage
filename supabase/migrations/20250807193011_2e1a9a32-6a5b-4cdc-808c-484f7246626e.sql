-- Add cover_rate to driver_profiles for overflow parcels
ALTER TABLE public.driver_profiles 
ADD COLUMN cover_rate NUMERIC;

-- Add rate to rounds table for route-specific rates
ALTER TABLE public.rounds 
ADD COLUMN IF NOT EXISTS rate NUMERIC;

-- Add cover parcel tracking to EOD reports
ALTER TABLE public.eod_reports 
ADD COLUMN cover_parcels INTEGER DEFAULT 0,
ADD COLUMN cover_confirmed BOOLEAN DEFAULT FALSE,
ADD COLUMN cover_confirmed_by UUID REFERENCES auth.users(id),
ADD COLUMN cover_confirmed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN manager_notes TEXT;

-- Update payments table to track different rate types
ALTER TABLE public.payments 
ADD COLUMN cover_parcels INTEGER DEFAULT 0,
ADD COLUMN cover_rate NUMERIC,
ADD COLUMN route_rate NUMERIC,
ADD COLUMN rate_breakdown JSONB DEFAULT '{}'::jsonb;

-- Create function to calculate driver pay with new rate structure
CREATE OR REPLACE FUNCTION public.calculate_driver_pay_with_rates(
  driver_id_param UUID,
  route_id_param UUID,
  regular_parcels_param INTEGER,
  cover_parcels_param INTEGER DEFAULT 0,
  base_pay_param NUMERIC DEFAULT 10.00
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  driver_base_rate NUMERIC;
  driver_cover_rate NUMERIC;
  route_rate NUMERIC;
  effective_rate NUMERIC;
  regular_pay NUMERIC;
  cover_pay NUMERIC;
  total_pay NUMERIC;
  breakdown JSONB;
BEGIN
  -- Get driver rates
  SELECT parcel_rate, cover_rate INTO driver_base_rate, driver_cover_rate
  FROM driver_profiles
  WHERE id = driver_id_param;
  
  -- Get route rate if exists
  SELECT rate INTO route_rate
  FROM rounds
  WHERE id = route_id_param;
  
  -- Determine effective rate (route rate overrides driver base rate)
  effective_rate := COALESCE(route_rate, driver_base_rate, 0);
  
  -- Calculate regular parcels pay
  regular_pay := regular_parcels_param * effective_rate;
  
  -- Calculate cover parcels pay (always uses driver's cover rate)
  cover_pay := cover_parcels_param * COALESCE(driver_cover_rate, driver_base_rate, 0);
  
  -- Calculate total
  total_pay := COALESCE(base_pay_param, 0) + regular_pay + cover_pay;
  
  -- Create breakdown
  breakdown := jsonb_build_object(
    'base_pay', COALESCE(base_pay_param, 0),
    'regular_parcels', regular_parcels_param,
    'regular_rate', effective_rate,
    'regular_pay', regular_pay,
    'cover_parcels', cover_parcels_param,
    'cover_rate', COALESCE(driver_cover_rate, driver_base_rate, 0),
    'cover_pay', cover_pay,
    'route_rate_applied', route_rate IS NOT NULL,
    'total_pay', total_pay
  );
  
  RETURN breakdown;
END;
$$;