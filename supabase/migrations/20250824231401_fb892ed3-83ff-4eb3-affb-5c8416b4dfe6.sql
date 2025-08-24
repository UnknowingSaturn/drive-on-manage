-- Check current user_companies entries for Wayne Cullen
SELECT uc.*, c.name as company_name 
FROM user_companies uc 
JOIN companies c ON c.id = uc.company_id
WHERE uc.user_id = '2cd2e897-835a-4d63-b910-b728b17caaf2';

-- Remove Wayne Cullen from Luxia company completely
DELETE FROM user_companies 
WHERE user_id = '2cd2e897-835a-4d63-b910-b728b17caaf2' 
AND company_id = '6fddb8b3-d158-4217-9917-72920c7f3646';