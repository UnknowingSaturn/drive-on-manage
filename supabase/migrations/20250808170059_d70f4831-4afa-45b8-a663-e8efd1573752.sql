-- Create sample test data for development
DO $$
DECLARE
    test_user_id uuid;
    test_company_id uuid;
    test_driver_id uuid;
    test_van_id uuid;
    test_round_id uuid;
BEGIN
    -- Check if we already have test data (prevent duplicates)
    IF NOT EXISTS (SELECT 1 FROM companies WHERE name = 'Saturn Logistics Test') THEN
        
        -- Get the current admin user (assuming they exist)
        SELECT user_id INTO test_user_id FROM profiles WHERE user_type = 'admin' LIMIT 1;
        
        IF test_user_id IS NOT NULL THEN
            -- Create test company
            INSERT INTO companies (id, name, email, phone, address, created_by) 
            VALUES (
                gen_random_uuid(),
                'Saturn Logistics Test',
                'test@saturnlogistics.com',
                '+44 123 456 7890',
                '123 Test Street, London, UK',
                test_user_id
            ) RETURNING id INTO test_company_id;
            
            -- Create test van
            INSERT INTO vans (id, company_id, registration, make, model, year) 
            VALUES (
                gen_random_uuid(),
                test_company_id,
                'SL01 ABC',
                'Ford',
                'Transit',
                2023
            ) RETURNING id INTO test_van_id;
            
            -- Create test round
            INSERT INTO rounds (id, company_id, round_number, description, rate, road_lists) 
            VALUES (
                gen_random_uuid(),
                test_company_id,
                'R001',
                'Central London Route',
                0.75,
                ARRAY['Main Street', 'High Street', 'King Road']
            ) RETURNING id INTO test_round_id;
            
            -- Update the admin profile's company_id if not set
            UPDATE profiles 
            SET company_id = test_company_id 
            WHERE user_id = test_user_id AND company_id IS NULL;
            
            RAISE NOTICE 'Test data created successfully for company: %', test_company_id;
        ELSE
            RAISE NOTICE 'No admin user found to create test data';
        END IF;
    ELSE
        RAISE NOTICE 'Test data already exists, skipping creation';
    END IF;
END $$;