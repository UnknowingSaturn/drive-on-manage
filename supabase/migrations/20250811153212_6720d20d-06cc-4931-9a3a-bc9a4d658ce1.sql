-- Update the admin profile to use the correct company_id
UPDATE profiles 
SET company_id = '7ca55934-3393-4613-937b-3882f76813ec' 
WHERE user_id = '3fc0f436-6d21-41f9-af5d-5048c590220d';

-- Verify the update
SELECT p.user_id, p.company_id, c.name as company_name 
FROM profiles p
JOIN companies c ON p.company_id = c.id
WHERE p.user_id = '3fc0f436-6d21-41f9-af5d-5048c590220d';