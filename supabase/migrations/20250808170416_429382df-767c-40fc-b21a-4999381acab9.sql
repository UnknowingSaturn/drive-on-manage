-- Performance optimization: Add indexes for frequently queried columns

-- Index for driver profiles company filtering
CREATE INDEX IF NOT EXISTS idx_driver_profiles_company_id ON public.driver_profiles(company_id);

-- Index for EOD reports filtering by driver and company
CREATE INDEX IF NOT EXISTS idx_eod_reports_driver_company ON public.eod_reports(driver_id, company_id);
CREATE INDEX IF NOT EXISTS idx_eod_reports_log_date ON public.eod_reports(log_date);

-- Index for SOD logs filtering
CREATE INDEX IF NOT EXISTS idx_sod_logs_driver_company ON public.sod_logs(driver_id, company_id);
CREATE INDEX IF NOT EXISTS idx_sod_logs_log_date ON public.sod_logs(log_date);

-- Index for driver earnings filtering
CREATE INDEX IF NOT EXISTS idx_driver_earnings_driver_date ON public.driver_earnings(driver_id, earning_date);

-- Index for driver expenses filtering
CREATE INDEX IF NOT EXISTS idx_driver_expenses_driver_company ON public.driver_expenses(driver_id, company_id);

-- Index for invitations token lookup
CREATE INDEX IF NOT EXISTS idx_driver_invitations_token ON public.driver_invitations(invite_token);

-- Index for schedules filtering
CREATE INDEX IF NOT EXISTS idx_schedules_driver_date ON public.schedules(driver_id, scheduled_date);

-- Index for vehicle checks filtering
CREATE INDEX IF NOT EXISTS idx_vehicle_checks_van_date ON public.vehicle_checks(van_id, check_date);

-- Composite index for real-time validation queries
CREATE INDEX IF NOT EXISTS idx_sod_logs_van_date ON public.sod_logs(van_id, log_date);

-- Index for payments filtering
CREATE INDEX IF NOT EXISTS idx_payments_driver_period ON public.payments(driver_id, period_start, period_end);

-- Add database constraints for data integrity
-- Ensure parcel counts are non-negative
ALTER TABLE public.sod_logs ADD CONSTRAINT chk_sod_parcel_count_positive CHECK (parcel_count >= 0);
ALTER TABLE public.eod_reports ADD CONSTRAINT chk_eod_parcel_count_positive CHECK (parcels_delivered >= 0);

-- Ensure dates are logical
ALTER TABLE public.driver_profiles ADD CONSTRAINT chk_license_expiry_future CHECK (license_expiry > CURRENT_DATE OR license_expiry IS NULL);

-- Ensure numeric values are valid
ALTER TABLE public.driver_profiles ADD CONSTRAINT chk_parcel_rate_positive CHECK (parcel_rate >= 0 OR parcel_rate IS NULL);
ALTER TABLE public.driver_profiles ADD CONSTRAINT chk_cover_rate_positive CHECK (cover_rate >= 0 OR cover_rate IS NULL);

-- Ensure earnings are non-negative
ALTER TABLE public.driver_earnings ADD CONSTRAINT chk_total_earnings_positive CHECK (total_earnings >= 0);