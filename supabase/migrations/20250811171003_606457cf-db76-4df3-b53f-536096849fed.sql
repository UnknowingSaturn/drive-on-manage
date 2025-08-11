-- Create a function to get drivers with their profile information
CREATE OR REPLACE FUNCTION public.get_drivers_with_profiles(company_ids uuid[])
RETURNS TABLE(
  id uuid,
  user_id uuid,
  company_id uuid,
  driving_license_number text,
  license_expiry date,
  right_to_work_document text,
  insurance_document text,
  driving_license_document text,
  parcel_rate numeric,
  assigned_van_id uuid,
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  avatar_url text,
  cover_rate numeric,
  first_login_completed boolean,
  requires_onboarding boolean,
  onboarding_completed_at timestamptz,
  emergency_contact_name text,
  emergency_contact_phone text,
  emergency_contact_relation text,
  vehicle_notes text,
  first_name text,
  last_name text,
  email text,
  phone text,
  is_active boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dp.id,
    dp.user_id,
    dp.company_id,
    dp.driving_license_number,
    dp.license_expiry,
    dp.right_to_work_document,
    dp.insurance_document,
    dp.driving_license_document,
    dp.parcel_rate,
    dp.assigned_van_id,
    dp.status,
    dp.created_at,
    dp.updated_at,
    dp.avatar_url,
    dp.cover_rate,
    dp.first_login_completed,
    dp.requires_onboarding,
    dp.onboarding_completed_at,
    dp.emergency_contact_name,
    dp.emergency_contact_phone,
    dp.emergency_contact_relation,
    dp.vehicle_notes,
    p.first_name,
    p.last_name,
    p.email,
    p.phone,
    p.is_active
  FROM driver_profiles dp
  INNER JOIN profiles p ON dp.user_id = p.user_id
  WHERE dp.company_id = ANY(company_ids)
  ORDER BY dp.created_at DESC;
END;
$$;