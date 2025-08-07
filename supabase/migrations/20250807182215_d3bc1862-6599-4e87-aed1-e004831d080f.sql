-- Clean up orphaned data before adding foreign key constraints

-- 1. Check and clean orphaned driver_invitations
DELETE FROM driver_invitations 
WHERE created_by NOT IN (SELECT user_id FROM profiles);

-- 2. Check and clean other potential orphaned records
DELETE FROM driver_invitations 
WHERE company_id NOT IN (SELECT id FROM companies);

DELETE FROM driver_profiles 
WHERE company_id NOT IN (SELECT id FROM companies);

DELETE FROM eod_reports 
WHERE driver_id NOT IN (SELECT id FROM driver_profiles);

DELETE FROM eod_reports 
WHERE company_id NOT IN (SELECT id FROM companies);

DELETE FROM incident_reports 
WHERE driver_id NOT IN (SELECT id FROM driver_profiles);

DELETE FROM incident_reports 
WHERE company_id NOT IN (SELECT id FROM companies);

DELETE FROM payments 
WHERE driver_id NOT IN (SELECT id FROM driver_profiles);

DELETE FROM payments 
WHERE company_id NOT IN (SELECT id FROM companies);

DELETE FROM daily_logs 
WHERE driver_id NOT IN (SELECT id FROM driver_profiles);

DELETE FROM daily_logs 
WHERE company_id NOT IN (SELECT id FROM companies);

DELETE FROM sod_logs 
WHERE driver_id NOT IN (SELECT id FROM driver_profiles);

DELETE FROM sod_logs 
WHERE company_id NOT IN (SELECT id FROM companies);

DELETE FROM vehicle_checks 
WHERE driver_id NOT IN (SELECT id FROM driver_profiles);

DELETE FROM vehicle_checks 
WHERE van_id NOT IN (SELECT id FROM vans);

DELETE FROM schedules 
WHERE driver_id NOT IN (SELECT id FROM driver_profiles);

DELETE FROM schedules 
WHERE company_id NOT IN (SELECT id FROM companies);

-- 3. Clean up any remaining orphaned references
UPDATE driver_invitations SET driver_profile_id = NULL 
WHERE driver_profile_id IS NOT NULL 
AND driver_profile_id NOT IN (SELECT id FROM driver_profiles);

UPDATE driver_profiles SET assigned_van_id = NULL 
WHERE assigned_van_id IS NOT NULL 
AND assigned_van_id NOT IN (SELECT id FROM vans);

UPDATE eod_reports SET approved_by = NULL 
WHERE approved_by IS NOT NULL 
AND approved_by NOT IN (SELECT user_id FROM profiles);

UPDATE payments SET exported_by = NULL 
WHERE exported_by IS NOT NULL 
AND exported_by NOT IN (SELECT user_id FROM profiles);