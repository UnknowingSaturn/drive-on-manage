-- Fix data inconsistency: Remove user_companies records where role doesn't match user_type
-- This prevents drivers from appearing in staff sections

-- Remove user_companies records where user has role 'admin' or 'supervisor' but profile shows user_type 'driver'
DELETE FROM user_companies 
WHERE user_companies.role IN ('admin', 'supervisor') 
AND user_companies.user_id IN (
    SELECT profiles.user_id 
    FROM profiles 
    WHERE profiles.user_type = 'driver'
);

-- Also remove any user_companies records where user has role 'driver' but profile shows user_type 'admin' or 'supervisor'
DELETE FROM user_companies 
WHERE user_companies.role = 'driver'
AND user_companies.user_id IN (
    SELECT profiles.user_id 
    FROM profiles 
    WHERE profiles.user_type IN ('admin', 'supervisor')
);

-- Insert correct user_companies records for admins and supervisors who don't have them
-- This ensures all admin/supervisor profiles have corresponding user_companies records
INSERT INTO user_companies (user_id, company_id, role)
SELECT 
    p.user_id,
    -- Get company_id from existing user_companies record or use the first company in the system
    COALESCE(
        (SELECT uc.company_id FROM user_companies uc WHERE uc.user_id = p.user_id LIMIT 1),
        (SELECT c.id FROM companies c ORDER BY c.created_at LIMIT 1)
    ) as company_id,
    p.user_type as role
FROM profiles p
WHERE p.user_type IN ('admin', 'supervisor')
AND NOT EXISTS (
    SELECT 1 FROM user_companies uc 
    WHERE uc.user_id = p.user_id 
    AND uc.role = p.user_type
)
AND EXISTS (SELECT 1 FROM companies); -- Only if companies exist