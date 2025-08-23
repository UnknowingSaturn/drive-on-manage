-- Fix remaining multiple permissive policies and optimize foreign key performance

-- =====================================================================
-- FIX ROUNDS TABLE: Remove duplicate SELECT policies
-- =====================================================================

-- Drop the ALL policy that creates duplicate SELECT permissions
DROP POLICY IF EXISTS "Admins can manage rounds in their companies" ON public.rounds;

-- Create separate CRUD policies for rounds (not ALL which includes SELECT)
CREATE POLICY "Admins can insert rounds in their companies" ON public.rounds
FOR INSERT 
WITH CHECK (user_has_company_role((SELECT auth.uid()), company_id, 'admin'));

CREATE POLICY "Admins can update rounds in their companies" ON public.rounds
FOR UPDATE 
USING (user_has_company_role((SELECT auth.uid()), company_id, 'admin'))
WITH CHECK (user_has_company_role((SELECT auth.uid()), company_id, 'admin'));

CREATE POLICY "Admins can delete rounds in their companies" ON public.rounds
FOR DELETE 
USING (user_has_company_role((SELECT auth.uid()), company_id, 'admin'));

-- =====================================================================
-- ADD FOREIGN KEY INDEXES FOR PERFORMANCE
-- =====================================================================

-- Add indexes for frequently queried foreign keys
CREATE INDEX IF NOT EXISTS idx_announcements_company_id ON public.announcements(company_id);
CREATE INDEX IF NOT EXISTS idx_announcements_created_by ON public.announcements(created_by);
CREATE INDEX IF NOT EXISTS idx_companies_created_by ON public.companies(created_by);
CREATE INDEX IF NOT EXISTS idx_daily_logs_company_id ON public.daily_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_daily_logs_round_id ON public.daily_logs(round_id);
CREATE INDEX IF NOT EXISTS idx_daily_logs_van_id ON public.daily_logs(van_id);
CREATE INDEX IF NOT EXISTS idx_driver_profiles_assigned_van_id ON public.driver_profiles(assigned_van_id);
CREATE INDEX IF NOT EXISTS idx_incident_reports_company_id ON public.incident_reports(company_id);
CREATE INDEX IF NOT EXISTS idx_incident_reports_driver_id ON public.incident_reports(driver_id);
CREATE INDEX IF NOT EXISTS idx_messages_replied_to ON public.messages(replied_to);
CREATE INDEX IF NOT EXISTS idx_user_companies_company_id ON public.user_companies(company_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_checks_driver_id ON public.vehicle_checks(driver_id);

-- =====================================================================
-- REMOVE UNUSED INDEXES TO REDUCE MAINTENANCE OVERHEAD
-- =====================================================================

-- Remove indexes that have never been used (they consume storage and slow down writes)
DROP INDEX IF EXISTS idx_payments_status;
DROP INDEX IF EXISTS idx_payments_locked;
DROP INDEX IF EXISTS idx_operating_costs_category;
DROP INDEX IF EXISTS idx_rounds_road_lists;
DROP INDEX IF EXISTS idx_route_feedback_date;
DROP INDEX IF EXISTS idx_driver_achievements_type;
DROP INDEX IF EXISTS idx_driver_expenses_driver_id;
DROP INDEX IF EXISTS idx_driver_expenses_date;
DROP INDEX IF EXISTS idx_driver_earnings_driver_id;
DROP INDEX IF EXISTS idx_driver_earnings_date;
DROP INDEX IF EXISTS idx_messages_company_created;
DROP INDEX IF EXISTS idx_messages_sender;
DROP INDEX IF EXISTS idx_driver_ratings_company;
DROP INDEX IF EXISTS idx_location_points_shift_id;
DROP INDEX IF EXISTS idx_driver_shifts_driver_status;
DROP INDEX IF EXISTS idx_location_stats_driver_date;
DROP INDEX IF EXISTS idx_driver_invoices_company_month;

-- Keep these indexes as they may be used in future queries:
-- idx_location_points_driver_timestamp - for location tracking queries
-- idx_user_companies_user_role - for role-based access control
-- idx_eod_reports_driver_date - for end-of-day report queries  
-- idx_sod_reports_driver_date - for start-of-day report queries
-- idx_driver_shifts_driver_date - for shift history queries
-- idx_messages_company_timestamp - for message loading