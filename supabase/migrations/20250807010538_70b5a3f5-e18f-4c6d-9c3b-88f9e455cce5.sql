-- First, create missing profile records for existing drivers
INSERT INTO profiles (user_id, email, first_name, last_name, user_type, company_id)
SELECT 
    dp.user_id,
    au.email,
    au.raw_user_meta_data->>'first_name' as first_name,
    au.raw_user_meta_data->>'last_name' as last_name,
    'driver' as user_type,
    dp.company_id
FROM driver_profiles dp
JOIN auth.users au ON dp.user_id = au.id
LEFT JOIN profiles p ON dp.user_id = p.user_id
WHERE p.user_id IS NULL;