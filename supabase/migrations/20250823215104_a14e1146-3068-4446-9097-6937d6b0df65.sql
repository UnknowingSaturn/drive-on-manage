-- Performance optimization for all RLS policies
-- Wrap auth.uid() and auth.role() in SELECT statements to prevent per-row evaluation

-- Drop existing policies and recreate with optimized versions

-- ANNOUNCEMENTS TABLE
DROP POLICY IF EXISTS "Users can view announcements for their companies" ON announcements;
CREATE POLICY "Users can view announcements for their companies" 
ON announcements FOR SELECT 
USING ((company_id IN ( 
  SELECT user_companies.company_id
  FROM user_companies
  WHERE (user_companies.user_id = (SELECT auth.uid()))
)) AND (is_active = true));

-- COMPANIES TABLE
DROP POLICY IF EXISTS "Admins can update companies they manage" ON companies;
CREATE POLICY "Admins can update companies they manage" 
ON companies FOR UPDATE 
USING (user_has_company_role((SELECT auth.uid()), id, 'admin'::text))
WITH CHECK (user_has_company_role((SELECT auth.uid()), id, 'admin'::text));

DROP POLICY IF EXISTS "Authenticated users can create companies" ON companies;
CREATE POLICY "Authenticated users can create companies" 
ON companies FOR INSERT 
WITH CHECK (created_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Super admins can delete companies" ON companies;
CREATE POLICY "Super admins can delete companies" 
ON companies FOR DELETE 
USING (EXISTS ( 
  SELECT 1 FROM profiles
  WHERE ((profiles.user_id = (SELECT auth.uid())) AND (profiles.user_type = 'admin'::text))
));

DROP POLICY IF EXISTS "Users can view companies they created" ON companies;
DROP POLICY IF EXISTS "Users can view companies they created or belong to" ON companies;
CREATE POLICY "Users can view companies they created or belong to" 
ON companies FOR SELECT 
USING ((created_by = (SELECT auth.uid())) OR (id IN ( 
  SELECT user_companies.company_id
  FROM user_companies
  WHERE (user_companies.user_id = (SELECT auth.uid()))
)));

-- COMPANY_REVENUE TABLE
DROP POLICY IF EXISTS "Admins can manage company revenue for their companies" ON company_revenue;
CREATE POLICY "Admins can manage company revenue for their companies" 
ON company_revenue FOR ALL 
USING (company_id IN ( 
  SELECT user_companies.company_id
  FROM user_companies
  WHERE ((user_companies.user_id = (SELECT auth.uid())) AND (user_companies.role = 'admin'::text))
))
WITH CHECK (company_id IN ( 
  SELECT user_companies.company_id
  FROM user_companies
  WHERE ((user_companies.user_id = (SELECT auth.uid())) AND (user_companies.role = 'admin'::text))
));

-- COMPANY_SETTINGS TABLE
DROP POLICY IF EXISTS "Admins can delete company settings for their companies" ON company_settings;
CREATE POLICY "Admins can delete company settings for their companies" 
ON company_settings FOR DELETE 
USING (user_has_company_role((SELECT auth.uid()), company_id, 'admin'::text));

DROP POLICY IF EXISTS "Admins can insert company settings for their companies" ON company_settings;
CREATE POLICY "Admins can insert company settings for their companies" 
ON company_settings FOR INSERT 
WITH CHECK (user_has_company_role((SELECT auth.uid()), company_id, 'admin'::text));

DROP POLICY IF EXISTS "Admins can update company settings for their companies" ON company_settings;
CREATE POLICY "Admins can update company settings for their companies" 
ON company_settings FOR UPDATE 
USING (user_has_company_role((SELECT auth.uid()), company_id, 'admin'::text))
WITH CHECK (user_has_company_role((SELECT auth.uid()), company_id, 'admin'::text));

DROP POLICY IF EXISTS "Admins can view company settings for their companies" ON company_settings;
CREATE POLICY "Admins can view company settings for their companies" 
ON company_settings FOR SELECT 
USING (user_has_company_role((SELECT auth.uid()), company_id, 'admin'::text));

-- DAILY_LOGS TABLE
DROP POLICY IF EXISTS "Drivers can insert their own logs" ON daily_logs;
CREATE POLICY "Drivers can insert their own logs" 
ON daily_logs FOR INSERT 
WITH CHECK (driver_id IN ( 
  SELECT dp.id FROM driver_profiles dp
  WHERE (dp.user_id = (SELECT auth.uid()))
));

DROP POLICY IF EXISTS "Drivers can update their own logs" ON daily_logs;
CREATE POLICY "Drivers can update their own logs" 
ON daily_logs FOR UPDATE 
USING (driver_id IN ( 
  SELECT dp.id FROM driver_profiles dp
  WHERE (dp.user_id = (SELECT auth.uid()))
));

-- DRIVER_ACHIEVEMENTS TABLE
DROP POLICY IF EXISTS "Drivers can view their own achievements" ON driver_achievements;
CREATE POLICY "Drivers can view their own achievements" 
ON driver_achievements FOR SELECT 
USING (driver_id IN ( 
  SELECT dp.id FROM driver_profiles dp
  WHERE (dp.user_id = (SELECT auth.uid()))
));

-- DRIVER_EARNINGS TABLE
DROP POLICY IF EXISTS "Drivers can view their own earnings" ON driver_earnings;
CREATE POLICY "Drivers can view their own earnings" 
ON driver_earnings FOR SELECT 
USING (driver_id IN ( 
  SELECT dp.id FROM driver_profiles dp
  WHERE (dp.user_id = (SELECT auth.uid()))
));

-- DRIVER_EXPENSES TABLE
DROP POLICY IF EXISTS "Drivers can manage their own expenses" ON driver_expenses;
CREATE POLICY "Drivers can manage their own expenses" 
ON driver_expenses FOR ALL 
USING (driver_id IN ( 
  SELECT dp.id FROM driver_profiles dp
  WHERE (dp.user_id = (SELECT auth.uid()))
))
WITH CHECK (driver_id IN ( 
  SELECT dp.id FROM driver_profiles dp
  WHERE (dp.user_id = (SELECT auth.uid()))
));

-- DRIVER_INVOICES TABLE
DROP POLICY IF EXISTS "Admins can delete invoices for their company" ON driver_invoices;
CREATE POLICY "Admins can delete invoices for their company" 
ON driver_invoices FOR DELETE 
USING (company_id IN ( 
  SELECT user_companies.company_id
  FROM user_companies
  WHERE ((user_companies.user_id = (SELECT auth.uid())) AND (user_companies.role = 'admin'::text))
));

DROP POLICY IF EXISTS "Admins can insert invoices for their company" ON driver_invoices;
CREATE POLICY "Admins can insert invoices for their company" 
ON driver_invoices FOR INSERT 
WITH CHECK (company_id IN ( 
  SELECT user_companies.company_id
  FROM user_companies
  WHERE ((user_companies.user_id = (SELECT auth.uid())) AND (user_companies.role = 'admin'::text))
));

DROP POLICY IF EXISTS "Admins can update invoices for their company" ON driver_invoices;
CREATE POLICY "Admins can update invoices for their company" 
ON driver_invoices FOR UPDATE 
USING (company_id IN ( 
  SELECT user_companies.company_id
  FROM user_companies
  WHERE ((user_companies.user_id = (SELECT auth.uid())) AND (user_companies.role = 'admin'::text))
))
WITH CHECK (company_id IN ( 
  SELECT user_companies.company_id
  FROM user_companies
  WHERE ((user_companies.user_id = (SELECT auth.uid())) AND (user_companies.role = 'admin'::text))
));

DROP POLICY IF EXISTS "Admins can view invoices for their company" ON driver_invoices;
CREATE POLICY "Admins can view invoices for their company" 
ON driver_invoices FOR SELECT 
USING (company_id IN ( 
  SELECT user_companies.company_id
  FROM user_companies
  WHERE ((user_companies.user_id = (SELECT auth.uid())) AND (user_companies.role = 'admin'::text))
));

DROP POLICY IF EXISTS "Drivers can view their own invoices" ON driver_invoices;
CREATE POLICY "Drivers can view their own invoices" 
ON driver_invoices FOR SELECT 
USING (driver_id IN ( 
  SELECT driver_profiles.id
  FROM driver_profiles
  WHERE (driver_profiles.user_id = (SELECT auth.uid()))
));

-- DRIVER_PROFILES TABLE
DROP POLICY IF EXISTS "Admins can insert driver profiles for their companies" ON driver_profiles;
CREATE POLICY "Admins can insert driver profiles for their companies" 
ON driver_profiles FOR INSERT 
WITH CHECK (user_has_company_role((SELECT auth.uid()), company_id, 'admin'::text));

DROP POLICY IF EXISTS "Admins can update driver profiles in their companies" ON driver_profiles;
CREATE POLICY "Admins can update driver profiles in their companies" 
ON driver_profiles FOR UPDATE 
USING (user_has_company_role((SELECT auth.uid()), company_id, 'admin'::text));

DROP POLICY IF EXISTS "Admins can view drivers in their associated companies" ON driver_profiles;
CREATE POLICY "Admins can view drivers in their associated companies" 
ON driver_profiles FOR SELECT 
USING ((user_id = (SELECT auth.uid())) OR (company_id IN ( 
  SELECT user_companies.company_id
  FROM user_companies
  WHERE ((user_companies.user_id = (SELECT auth.uid())) AND (user_companies.role = 'admin'::text))
)));

DROP POLICY IF EXISTS "Drivers can manage their own profile" ON driver_profiles;
CREATE POLICY "Drivers can manage their own profile" 
ON driver_profiles FOR ALL 
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Drivers can update their own profile" ON driver_profiles;
DROP POLICY IF EXISTS "Drivers can view their own profile" ON driver_profiles;
-- Already covered by "Drivers can manage their own profile"

-- DRIVER_RATINGS TABLE
DROP POLICY IF EXISTS "Drivers can view their own ratings" ON driver_ratings;
CREATE POLICY "Drivers can view their own ratings" 
ON driver_ratings FOR SELECT 
USING (driver_id IN ( 
  SELECT dp.id FROM driver_profiles dp
  WHERE (dp.user_id = (SELECT auth.uid()))
));

-- DRIVER_SHIFTS TABLE
DROP POLICY IF EXISTS "Drivers can manage their own shifts" ON driver_shifts;
CREATE POLICY "Drivers can manage their own shifts" 
ON driver_shifts FOR ALL 
USING (driver_id IN ( 
  SELECT dp.id FROM driver_profiles dp
  WHERE (dp.user_id = (SELECT auth.uid()))
))
WITH CHECK (driver_id IN ( 
  SELECT dp.id FROM driver_profiles dp
  WHERE (dp.user_id = (SELECT auth.uid()))
));

DROP POLICY IF EXISTS "Management can view shifts for their drivers" ON driver_shifts;
CREATE POLICY "Management can view shifts for their drivers" 
ON driver_shifts FOR SELECT 
USING (company_id IN ( 
  SELECT uc.company_id FROM user_companies uc
  WHERE ((uc.user_id = (SELECT auth.uid())) AND (uc.role = ANY (ARRAY['admin'::text, 'supervisor'::text])))
));

-- END_OF_DAY_REPORTS TABLE
DROP POLICY IF EXISTS "Admins can update EOD reports in their companies" ON end_of_day_reports;
CREATE POLICY "Admins can update EOD reports in their companies" 
ON end_of_day_reports FOR UPDATE 
USING (company_id IN ( 
  SELECT uc.company_id FROM user_companies uc
  WHERE ((uc.user_id = (SELECT auth.uid())) AND (uc.role = 'admin'::text))
))
WITH CHECK (company_id IN ( 
  SELECT uc.company_id FROM user_companies uc
  WHERE ((uc.user_id = (SELECT auth.uid())) AND (uc.role = 'admin'::text))
));

DROP POLICY IF EXISTS "Admins can view EOD reports in their companies" ON end_of_day_reports;
CREATE POLICY "Admins can view EOD reports in their companies" 
ON end_of_day_reports FOR SELECT 
USING (company_id IN ( 
  SELECT uc.company_id FROM user_companies uc
  WHERE ((uc.user_id = (SELECT auth.uid())) AND (uc.role = 'admin'::text))
));

DROP POLICY IF EXISTS "Drivers can insert their own EOD reports" ON end_of_day_reports;
CREATE POLICY "Drivers can insert their own EOD reports" 
ON end_of_day_reports FOR INSERT 
WITH CHECK (driver_id IN ( 
  SELECT dp.id FROM driver_profiles dp
  WHERE (dp.user_id = (SELECT auth.uid()))
));

DROP POLICY IF EXISTS "Drivers can view their own EOD reports" ON end_of_day_reports;
CREATE POLICY "Drivers can view their own EOD reports" 
ON end_of_day_reports FOR SELECT 
USING (driver_id IN ( 
  SELECT dp.id FROM driver_profiles dp
  WHERE (dp.user_id = (SELECT auth.uid()))
));

-- INCIDENT_REPORTS TABLE
DROP POLICY IF EXISTS "Drivers can insert incident reports" ON incident_reports;
CREATE POLICY "Drivers can insert incident reports" 
ON incident_reports FOR INSERT 
WITH CHECK (driver_id IN ( 
  SELECT dp.id FROM driver_profiles dp
  WHERE (dp.user_id = (SELECT auth.uid()))
));

DROP POLICY IF EXISTS "Drivers can view their own incident reports" ON incident_reports;
CREATE POLICY "Drivers can view their own incident reports" 
ON incident_reports FOR SELECT 
USING (driver_id IN ( 
  SELECT dp.id FROM driver_profiles dp
  WHERE (dp.user_id = (SELECT auth.uid()))
));

-- LOCATION_ACCESS_LOGS TABLE
DROP POLICY IF EXISTS "Admins can view access logs for their company" ON location_access_logs;
CREATE POLICY "Admins can view access logs for their company" 
ON location_access_logs FOR SELECT 
USING (company_id IN ( 
  SELECT uc.company_id FROM user_companies uc
  WHERE ((uc.user_id = (SELECT auth.uid())) AND (uc.role = 'admin'::text))
));

DROP POLICY IF EXISTS "Users can insert their own access logs" ON location_access_logs;
CREATE POLICY "Users can insert their own access logs" 
ON location_access_logs FOR INSERT 
WITH CHECK (user_id = (SELECT auth.uid()));

-- LOCATION_POINTS TABLE
DROP POLICY IF EXISTS "Drivers can insert their own location points" ON location_points;
CREATE POLICY "Drivers can insert their own location points" 
ON location_points FOR INSERT 
WITH CHECK (driver_id IN ( 
  SELECT dp.id FROM driver_profiles dp
  WHERE (dp.user_id = (SELECT auth.uid()))
));

DROP POLICY IF EXISTS "Drivers can view their own location points" ON location_points;
CREATE POLICY "Drivers can view their own location points" 
ON location_points FOR SELECT 
USING (driver_id IN ( 
  SELECT dp.id FROM driver_profiles dp
  WHERE (dp.user_id = (SELECT auth.uid()))
));

DROP POLICY IF EXISTS "Management can view location points for their drivers" ON location_points;
CREATE POLICY "Management can view location points for their drivers" 
ON location_points FOR SELECT 
USING (company_id IN ( 
  SELECT uc.company_id FROM user_companies uc
  WHERE ((uc.user_id = (SELECT auth.uid())) AND (uc.role = ANY (ARRAY['admin'::text, 'supervisor'::text])))
));

-- LOCATION_STATS_DAILY TABLE
DROP POLICY IF EXISTS "Drivers can view their own stats" ON location_stats_daily;
CREATE POLICY "Drivers can view their own stats" 
ON location_stats_daily FOR SELECT 
USING (driver_id IN ( 
  SELECT dp.id FROM driver_profiles dp
  WHERE (dp.user_id = (SELECT auth.uid()))
));

DROP POLICY IF EXISTS "Management can view stats for their drivers" ON location_stats_daily;
CREATE POLICY "Management can view stats for their drivers" 
ON location_stats_daily FOR SELECT 
USING (company_id IN ( 
  SELECT uc.company_id FROM user_companies uc
  WHERE ((uc.user_id = (SELECT auth.uid())) AND (uc.role = ANY (ARRAY['admin'::text, 'supervisor'::text])))
));

-- MESSAGES TABLE
DROP POLICY IF EXISTS "Users can update their own messages" ON messages;
CREATE POLICY "Users can update their own messages" 
ON messages FOR UPDATE 
USING (sender_id = (SELECT auth.uid()))
WITH CHECK (sender_id = (SELECT auth.uid()));

-- OPERATING_COSTS TABLE
DROP POLICY IF EXISTS "Admins can delete operating costs for their companies" ON operating_costs;
CREATE POLICY "Admins can delete operating costs for their companies" 
ON operating_costs FOR DELETE 
USING (user_has_company_role((SELECT auth.uid()), company_id, 'admin'::text));

DROP POLICY IF EXISTS "Admins can insert operating costs for their companies" ON operating_costs;
CREATE POLICY "Admins can insert operating costs for their companies" 
ON operating_costs FOR INSERT 
WITH CHECK (user_has_company_role((SELECT auth.uid()), company_id, 'admin'::text) AND (created_by = (SELECT auth.uid())));

DROP POLICY IF EXISTS "Admins can update operating costs for their companies" ON operating_costs;
CREATE POLICY "Admins can update operating costs for their companies" 
ON operating_costs FOR UPDATE 
USING (user_has_company_role((SELECT auth.uid()), company_id, 'admin'::text))
WITH CHECK (user_has_company_role((SELECT auth.uid()), company_id, 'admin'::text));

DROP POLICY IF EXISTS "Admins can view operating costs for their companies" ON operating_costs;
CREATE POLICY "Admins can view operating costs for their companies" 
ON operating_costs FOR SELECT 
USING (user_has_company_role((SELECT auth.uid()), company_id, 'admin'::text));

-- PAYMENTS TABLE
DROP POLICY IF EXISTS "Drivers can view their own payments" ON payments;
CREATE POLICY "Drivers can view their own payments" 
ON payments FOR SELECT 
USING (driver_id IN ( 
  SELECT driver_profiles.id FROM driver_profiles
  WHERE (driver_profiles.user_id = (SELECT auth.uid()))
));

-- PROFILES TABLE
DROP POLICY IF EXISTS "Admins can create admin profiles" ON profiles;
CREATE POLICY "Admins can create admin profiles" 
ON profiles FOR INSERT 
WITH CHECK ((user_id = (SELECT auth.uid())) AND (user_type = 'admin'::text));

DROP POLICY IF EXISTS "Admins can create driver profiles for their companies" ON profiles;
CREATE POLICY "Admins can create driver profiles for their companies" 
ON profiles FOR INSERT 
WITH CHECK ((user_type = 'driver'::text) AND (EXISTS ( 
  SELECT 1 FROM user_companies uc
  WHERE ((uc.user_id = (SELECT auth.uid())) AND (uc.role = 'admin'::text))
)));

DROP POLICY IF EXISTS "Admins can view driver profiles in their companies" ON profiles;
CREATE POLICY "Admins can view driver profiles in their companies" 
ON profiles FOR SELECT 
USING ((user_id = (SELECT auth.uid())) OR ((user_type = 'driver'::text) AND (EXISTS ( 
  SELECT 1 FROM user_companies uc1, user_companies uc2
  WHERE ((uc1.user_id = (SELECT auth.uid())) AND (uc1.role = 'admin'::text) AND (uc2.user_id = profiles.user_id) AND (uc1.company_id = uc2.company_id))
))));

DROP POLICY IF EXISTS "Service role can create profiles" ON profiles;
CREATE POLICY "Service role can create profiles" 
ON profiles FOR INSERT 
WITH CHECK ((SELECT auth.role()) = 'service_role'::text);

DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile" 
ON profiles FOR UPDATE 
USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
CREATE POLICY "Users can view their own profile" 
ON profiles FOR SELECT 
USING (user_id = (SELECT auth.uid()));

-- ROUNDS TABLE
DROP POLICY IF EXISTS "Admins can manage rounds in their companies" ON rounds;
CREATE POLICY "Admins can manage rounds in their companies" 
ON rounds FOR ALL 
USING (user_has_company_role((SELECT auth.uid()), company_id, 'admin'::text))
WITH CHECK (user_has_company_role((SELECT auth.uid()), company_id, 'admin'::text));

DROP POLICY IF EXISTS "Drivers can view rounds they are scheduled for" ON rounds;
CREATE POLICY "Drivers can view rounds they are scheduled for" 
ON rounds FOR SELECT 
USING (id IN ( 
  SELECT schedules.round_id FROM schedules
  WHERE (schedules.driver_id IN ( 
    SELECT driver_profiles.id FROM driver_profiles
    WHERE (driver_profiles.user_id = (SELECT auth.uid()))
  ))
));

-- ROUTE_FEEDBACK TABLE
DROP POLICY IF EXISTS "Drivers can insert their own feedback" ON route_feedback;
CREATE POLICY "Drivers can insert their own feedback" 
ON route_feedback FOR INSERT 
WITH CHECK (driver_id IN ( 
  SELECT dp.id FROM driver_profiles dp
  WHERE (dp.user_id = (SELECT auth.uid()))
));

DROP POLICY IF EXISTS "Drivers can view their own feedback" ON route_feedback;
CREATE POLICY "Drivers can view their own feedback" 
ON route_feedback FOR SELECT 
USING (driver_id IN ( 
  SELECT dp.id FROM driver_profiles dp
  WHERE (dp.user_id = (SELECT auth.uid()))
));

-- SCHEDULES TABLE
DROP POLICY IF EXISTS "Admins can delete schedules for their company" ON schedules;
CREATE POLICY "Admins can delete schedules for their company" 
ON schedules FOR DELETE 
USING (user_has_company_role((SELECT auth.uid()), company_id, 'admin'::text));

DROP POLICY IF EXISTS "Admins can insert schedules for their company" ON schedules;
CREATE POLICY "Admins can insert schedules for their company" 
ON schedules FOR INSERT 
WITH CHECK (user_has_company_role((SELECT auth.uid()), company_id, 'admin'::text));

DROP POLICY IF EXISTS "Admins can update schedules for their company" ON schedules;
CREATE POLICY "Admins can update schedules for their company" 
ON schedules FOR UPDATE 
USING (user_has_company_role((SELECT auth.uid()), company_id, 'admin'::text))
WITH CHECK (user_has_company_role((SELECT auth.uid()), company_id, 'admin'::text));

DROP POLICY IF EXISTS "Admins can view schedules for their company" ON schedules;
CREATE POLICY "Admins can view schedules for their company" 
ON schedules FOR SELECT 
USING (user_has_company_role((SELECT auth.uid()), company_id, 'admin'::text));

DROP POLICY IF EXISTS "Drivers can view their own schedules" ON schedules;
CREATE POLICY "Drivers can view their own schedules" 
ON schedules FOR SELECT 
USING (driver_id IN ( 
  SELECT driver_profiles.id FROM driver_profiles
  WHERE (driver_profiles.user_id = (SELECT auth.uid()))
));

-- START_OF_DAY_REPORTS TABLE
DROP POLICY IF EXISTS "Admins can update SOD reports in their companies" ON start_of_day_reports;
CREATE POLICY "Admins can update SOD reports in their companies" 
ON start_of_day_reports FOR UPDATE 
USING (company_id IN ( 
  SELECT uc.company_id FROM user_companies uc
  WHERE ((uc.user_id = (SELECT auth.uid())) AND (uc.role = 'admin'::text))
))
WITH CHECK (company_id IN ( 
  SELECT uc.company_id FROM user_companies uc
  WHERE ((uc.user_id = (SELECT auth.uid())) AND (uc.role = 'admin'::text))
));

DROP POLICY IF EXISTS "Admins can view SOD reports in their companies" ON start_of_day_reports;
CREATE POLICY "Admins can view SOD reports in their companies" 
ON start_of_day_reports FOR SELECT 
USING (company_id IN ( 
  SELECT uc.company_id FROM user_companies uc
  WHERE ((uc.user_id = (SELECT auth.uid())) AND (uc.role = 'admin'::text))
));

DROP POLICY IF EXISTS "Drivers can insert their own SOD reports" ON start_of_day_reports;
CREATE POLICY "Drivers can insert their own SOD reports" 
ON start_of_day_reports FOR INSERT 
WITH CHECK (driver_id IN ( 
  SELECT dp.id FROM driver_profiles dp
  WHERE (dp.user_id = (SELECT auth.uid()))
));

DROP POLICY IF EXISTS "Drivers can view their own SOD reports" ON start_of_day_reports;
CREATE POLICY "Drivers can view their own SOD reports" 
ON start_of_day_reports FOR SELECT 
USING (driver_id IN ( 
  SELECT dp.id FROM driver_profiles dp
  WHERE (dp.user_id = (SELECT auth.uid()))
));

-- USER_COMPANIES TABLE
DROP POLICY IF EXISTS "Admins can create driver associations for their companies" ON user_companies;
CREATE POLICY "Admins can create driver associations for their companies" 
ON user_companies FOR INSERT 
WITH CHECK (EXISTS ( 
  SELECT 1 FROM user_companies uc
  WHERE ((uc.user_id = (SELECT auth.uid())) AND (uc.company_id = user_companies.company_id) AND (uc.role = 'admin'::text))
));

DROP POLICY IF EXISTS "Service role can create user companies" ON user_companies;
CREATE POLICY "Service role can create user companies" 
ON user_companies FOR INSERT 
WITH CHECK ((SELECT auth.role()) = 'service_role'::text);

DROP POLICY IF EXISTS "Users can manage their own company associations" ON user_companies;
CREATE POLICY "Users can manage their own company associations" 
ON user_companies FOR ALL 
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));