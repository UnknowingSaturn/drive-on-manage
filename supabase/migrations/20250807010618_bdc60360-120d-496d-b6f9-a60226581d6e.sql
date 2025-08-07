-- Manually create the missing profile record
INSERT INTO profiles (user_id, email, first_name, last_name, user_type, company_id)
VALUES (
    '45f11286-febf-4bb2-909b-78ebf956f5e2',
    'mmatambo.mm@gmail.com',  -- From the invitation data
    'Mark',
    'Ikahu',
    'driver',
    '269d8398-9a24-452d-9771-98fb6117a176'
)
ON CONFLICT (user_id) DO NOTHING;