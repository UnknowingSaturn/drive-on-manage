-- Fix missing user_companies entry for the supervisor that was created
-- This ensures the supervisor appears in the staff list
INSERT INTO user_companies (user_id, company_id, role) 
VALUES ('203f7696-918c-4e80-9dd3-025836909f31', '6fddb8b3-d158-4217-9917-72920c7f3646', 'supervisor')
ON CONFLICT (user_id, company_id) DO NOTHING;