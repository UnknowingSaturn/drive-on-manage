-- Remove the existing orphaned driver profile that has no corresponding auth user
DELETE FROM driver_profiles 
WHERE user_id = '45f11286-febf-4bb2-909b-78ebf956f5e2';

-- Now add the foreign key relationship between driver_profiles and profiles  
ALTER TABLE driver_profiles 
ADD CONSTRAINT fk_driver_profiles_user_id 
FOREIGN KEY (user_id) REFERENCES profiles(user_id) ON DELETE CASCADE;