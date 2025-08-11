-- Reset password for Daniel driver to fix authentication issue
-- This generates a new temporary password and updates the auth.users table

DO $$
DECLARE
    daniel_user_id UUID;
    new_temp_password TEXT := 'TempPass123!';
BEGIN
    -- Get Daniel's user_id from profiles
    SELECT p.user_id INTO daniel_user_id
    FROM profiles p 
    WHERE p.email = 'daniel.owl91@gmail.com';
    
    IF daniel_user_id IS NOT NULL THEN
        -- Update the password in auth.users using the admin function
        UPDATE auth.users 
        SET encrypted_password = crypt(new_temp_password, gen_salt('bf')),
            updated_at = now()
        WHERE id = daniel_user_id;
        
        RAISE NOTICE 'Password reset for Daniel. New temp password: %', new_temp_password;
    ELSE
        RAISE NOTICE 'Daniel user not found';
    END IF;
END $$;