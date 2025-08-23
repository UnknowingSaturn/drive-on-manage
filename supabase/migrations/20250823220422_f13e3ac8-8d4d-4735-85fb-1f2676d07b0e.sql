-- Final Phase: Merge Remaining Multiple Permissive Policies

-- 6. Merge LOCATION_POINTS policies
DROP POLICY IF EXISTS "Drivers can view their own location points" ON location_points;
DROP POLICY IF EXISTS "Management can view location points for their drivers" ON location_points;

CREATE POLICY "Users can view location points" 
ON location_points FOR SELECT 
USING (
  -- Drivers can view their own location points
  (driver_id IN ( 
    SELECT dp.id FROM driver_profiles dp
    WHERE (dp.user_id = (SELECT auth.uid()))
  )) OR
  -- Management can view location points for their drivers
  (company_id IN ( 
    SELECT uc.company_id FROM user_companies uc
    WHERE ((uc.user_id = (SELECT auth.uid())) AND (uc.role = ANY (ARRAY['admin'::text, 'supervisor'::text])))
  ))
);

-- 7. Merge LOCATION_STATS_DAILY policies
DROP POLICY IF EXISTS "Drivers can view their own stats" ON location_stats_daily;
DROP POLICY IF EXISTS "Management can view stats for their drivers" ON location_stats_daily;

CREATE POLICY "Users can view location stats" 
ON location_stats_daily FOR SELECT 
USING (
  -- Drivers can view their own stats
  (driver_id IN ( 
    SELECT dp.id FROM driver_profiles dp
    WHERE (dp.user_id = (SELECT auth.uid()))
  )) OR
  -- Management can view stats for their drivers
  (company_id IN ( 
    SELECT uc.company_id FROM user_companies uc
    WHERE ((uc.user_id = (SELECT auth.uid())) AND (uc.role = ANY (ARRAY['admin'::text, 'supervisor'::text])))
  ))
);

-- 8. Merge PAYMENTS policies (already done but double-check)
DROP POLICY IF EXISTS "Drivers can view only their own payments" ON payments;
DROP POLICY IF EXISTS "Admins can view all payments in their companies" ON payments;

CREATE POLICY "Users can view payments" 
ON payments FOR SELECT 
USING (
  -- Drivers can view their own payments
  (driver_id IN ( 
    SELECT driver_profiles.id FROM driver_profiles
    WHERE (driver_profiles.user_id = (SELECT auth.uid()))
  )) OR
  -- Admins can view all payments in their companies
  (company_id IN ( 
    SELECT uc.company_id FROM user_companies uc
    WHERE ((uc.user_id = (SELECT auth.uid())) AND (uc.role = 'admin'::text))
  ))
);