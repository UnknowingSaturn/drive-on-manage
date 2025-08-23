-- Continue Merging Multiple Permissive Policies - Part 2

-- 4. Merge DRIVER_SHIFTS policies
DROP POLICY IF EXISTS "Drivers can manage their own shifts" ON driver_shifts;
DROP POLICY IF EXISTS "Management can view shifts for their drivers" ON driver_shifts;

CREATE POLICY "Users can view driver shifts" 
ON driver_shifts FOR SELECT 
USING (
  -- Drivers can view their own shifts
  (driver_id IN ( 
    SELECT dp.id FROM driver_profiles dp
    WHERE (dp.user_id = (SELECT auth.uid()))
  )) OR
  -- Management can view shifts for their drivers
  (company_id IN ( 
    SELECT uc.company_id FROM user_companies uc
    WHERE ((uc.user_id = (SELECT auth.uid())) AND (uc.role = ANY (ARRAY['admin'::text, 'supervisor'::text])))
  ))
);

CREATE POLICY "Drivers can manage their own shifts" 
ON driver_shifts FOR INSERT 
WITH CHECK (driver_id IN ( 
  SELECT dp.id FROM driver_profiles dp
  WHERE (dp.user_id = (SELECT auth.uid()))
));

CREATE POLICY "Drivers can update their own shifts" 
ON driver_shifts FOR UPDATE 
USING (driver_id IN ( 
  SELECT dp.id FROM driver_profiles dp
  WHERE (dp.user_id = (SELECT auth.uid()))
))
WITH CHECK (driver_id IN ( 
  SELECT dp.id FROM driver_profiles dp
  WHERE (dp.user_id = (SELECT auth.uid()))
));

CREATE POLICY "Drivers can delete their own shifts" 
ON driver_shifts FOR DELETE 
USING (driver_id IN ( 
  SELECT dp.id FROM driver_profiles dp
  WHERE (dp.user_id = (SELECT auth.uid()))
));

-- 5. Merge END_OF_DAY_REPORTS policies
DROP POLICY IF EXISTS "Admins can view EOD reports in their companies" ON end_of_day_reports;
DROP POLICY IF EXISTS "Drivers can view their own EOD reports" ON end_of_day_reports;

CREATE POLICY "Users can view EOD reports" 
ON end_of_day_reports FOR SELECT 
USING (
  -- Drivers can view their own reports
  (driver_id IN ( 
    SELECT dp.id FROM driver_profiles dp
    WHERE (dp.user_id = (SELECT auth.uid()))
  )) OR
  -- Admins can view all reports in their companies
  (company_id IN ( 
    SELECT uc.company_id FROM user_companies uc
    WHERE ((uc.user_id = (SELECT auth.uid())) AND (uc.role = 'admin'::text))
  ))
);