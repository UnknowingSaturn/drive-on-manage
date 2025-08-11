-- Create the missing driver_profile for the existing user
INSERT INTO driver_profiles (
  user_id, 
  company_id, 
  parcel_rate, 
  cover_rate, 
  status, 
  requires_onboarding, 
  first_login_completed
) VALUES (
  'aaaa0e20-bca5-421b-b9a0-e36905d62b30',
  '7ca55934-3393-4613-937b-3882f76813ec',
  0.75,
  1.0,
  'pending_onboarding',
  true,
  false
) 
ON CONFLICT (user_id) DO NOTHING;