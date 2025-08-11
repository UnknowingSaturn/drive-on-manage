-- Fix the foreign key relationship between driver_profiles and profiles
-- Currently driver_profiles.user_id references auth.users.id
-- We need to ensure the profiles table has the correct constraint

-- First, let's check and potentially add a unique constraint on profiles.user_id if it doesn't exist
DO $$ 
BEGIN
    -- Add unique constraint on profiles.user_id if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'profiles_user_id_unique'
    ) THEN
        ALTER TABLE profiles ADD CONSTRAINT profiles_user_id_unique UNIQUE (user_id);
    END IF;
EXCEPTION
    WHEN duplicate_table THEN NULL;
    WHEN others THEN 
        -- If constraint already exists with different name, skip
        NULL;
END $$;

-- Ensure we have the correct data by checking if driver's profile exists
-- If not, create it from the auth.users metadata
INSERT INTO profiles (user_id, email, first_name, last_name, user_type)
SELECT 
    au.id,
    au.email,
    au.raw_user_meta_data ->> 'first_name',
    au.raw_user_meta_data ->> 'last_name',
    'driver'
FROM auth.users au
LEFT JOIN profiles p ON au.id = p.user_id
WHERE p.user_id IS NULL
  AND au.id IN (SELECT user_id FROM driver_profiles)
ON CONFLICT (user_id) DO NOTHING;