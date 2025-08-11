-- Create the missing user_companies association for the orphaned driver
INSERT INTO user_companies (user_id, company_id, role)
SELECT dp.user_id, dp.company_id, 'member'
FROM driver_profiles dp
LEFT JOIN user_companies uc ON uc.user_id = dp.user_id AND uc.company_id = dp.company_id
WHERE dp.company_id = '6fddb8b3-d158-4217-9917-72920c7f3646'
  AND uc.user_id IS NULL  -- Only if association doesn't exist
ON CONFLICT (user_id, company_id) DO NOTHING;