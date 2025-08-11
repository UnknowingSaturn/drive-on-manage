-- First, let's see who created which companies
-- We'll remove all user_companies associations and recreate them properly

-- Clear all existing user_companies associations
DELETE FROM user_companies;

-- Now, let's properly associate users with companies they created
INSERT INTO user_companies (user_id, company_id, role)
SELECT created_by, id, 'admin'
FROM companies
WHERE created_by IS NOT NULL;

-- Also ensure that if someone doesn't have a company created by them,
-- we don't create any associations (they should create their own company)