-- Fix the driver_profile company_id to match the profile's company_id
UPDATE driver_profiles 
SET company_id = '7ca55934-3393-4613-937b-3882f76813ec'
WHERE user_id = 'aaaa0e20-bca5-421b-b9a0-e36905d62b30';