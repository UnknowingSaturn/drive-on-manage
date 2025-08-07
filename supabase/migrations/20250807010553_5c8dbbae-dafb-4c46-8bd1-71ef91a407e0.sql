-- Enable RLS on profiles table to fix security warnings
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Now add the foreign key relationship between driver_profiles and profiles
ALTER TABLE driver_profiles 
ADD CONSTRAINT fk_driver_profiles_user_id 
FOREIGN KEY (user_id) REFERENCES profiles(user_id) ON DELETE CASCADE;