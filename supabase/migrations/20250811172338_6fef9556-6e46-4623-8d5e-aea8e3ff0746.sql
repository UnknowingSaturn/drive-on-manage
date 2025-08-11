-- Generate and set original format password for Daniel
DO $$
DECLARE
    daniel_user_id UUID;
    original_format_password TEXT;
BEGIN
    -- Get Daniel's user_id from profiles
    SELECT p.user_id INTO daniel_user_id
    FROM profiles p 
    WHERE p.email = 'daniel.owl91@gmail.com';
    
    IF daniel_user_id IS NOT NULL THEN
        -- Generate password in original format: random(8) + 'A1!'
        original_format_password := substring(md5(random()::text), 1, 8) || 'A1!';
        
        -- Update the password in auth.users
        UPDATE auth.users 
        SET encrypted_password = crypt(original_format_password, gen_salt('bf')),
            updated_at = now()
        WHERE id = daniel_user_id;
        
        RAISE NOTICE 'Original format password set for Daniel: %', original_format_password;
    ELSE
        RAISE NOTICE 'Daniel user not found';
    END IF;
END $$;