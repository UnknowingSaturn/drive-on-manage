-- Fix the existing driver profile that was created without proper company_id
UPDATE profiles 
SET company_id = '7ca55934-3393-4613-937b-3882f76813ec' 
WHERE user_id = 'aaaa0e20-bca5-421b-b9a0-e36905d62b30' AND company_id IS NULL;

-- Also fix the admin profile company_id if it's wrong
UPDATE profiles 
SET company_id = '7ca55934-3393-4613-937b-3882f76813ec' 
WHERE user_id = '3fc0f436-6d21-41f9-af5d-5048c590220d';