-- Fix Foreign Key Relationships and Add Missing Constraints

-- 1. Add missing foreign key constraints
ALTER TABLE daily_logs 
ADD CONSTRAINT fk_daily_logs_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
ADD CONSTRAINT fk_daily_logs_driver FOREIGN KEY (driver_id) REFERENCES driver_profiles(id) ON DELETE CASCADE,
ADD CONSTRAINT fk_daily_logs_van FOREIGN KEY (van_id) REFERENCES vans(id) ON DELETE SET NULL,
ADD CONSTRAINT fk_daily_logs_round FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE SET NULL;

ALTER TABLE driver_invitations
ADD CONSTRAINT fk_driver_invitations_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
ADD CONSTRAINT fk_driver_invitations_created_by FOREIGN KEY (created_by) REFERENCES profiles(user_id) ON DELETE CASCADE,
ADD CONSTRAINT fk_driver_invitations_driver_profile FOREIGN KEY (driver_profile_id) REFERENCES driver_profiles(id) ON DELETE SET NULL;

ALTER TABLE driver_profiles
ADD CONSTRAINT fk_driver_profiles_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
ADD CONSTRAINT fk_driver_profiles_assigned_van FOREIGN KEY (assigned_van_id) REFERENCES vans(id) ON DELETE SET NULL;

ALTER TABLE eod_reports
ADD CONSTRAINT fk_eod_reports_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
ADD CONSTRAINT fk_eod_reports_driver FOREIGN KEY (driver_id) REFERENCES driver_profiles(id) ON DELETE CASCADE,
ADD CONSTRAINT fk_eod_reports_van FOREIGN KEY (van_id) REFERENCES vans(id) ON DELETE SET NULL,
ADD CONSTRAINT fk_eod_reports_approved_by FOREIGN KEY (approved_by) REFERENCES profiles(user_id) ON DELETE SET NULL;

ALTER TABLE incident_reports
ADD CONSTRAINT fk_incident_reports_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
ADD CONSTRAINT fk_incident_reports_driver FOREIGN KEY (driver_id) REFERENCES driver_profiles(id) ON DELETE CASCADE;

ALTER TABLE invitation_audit_log
ADD CONSTRAINT fk_invitation_audit_log_invitation FOREIGN KEY (invitation_id) REFERENCES driver_invitations(id) ON DELETE CASCADE,
ADD CONSTRAINT fk_invitation_audit_log_performed_by FOREIGN KEY (performed_by) REFERENCES profiles(user_id) ON DELETE CASCADE;

ALTER TABLE invitation_rate_limits
ADD CONSTRAINT fk_invitation_rate_limits_user FOREIGN KEY (user_id) REFERENCES profiles(user_id) ON DELETE CASCADE,
ADD CONSTRAINT fk_invitation_rate_limits_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE payments
ADD CONSTRAINT fk_payments_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
ADD CONSTRAINT fk_payments_driver FOREIGN KEY (driver_id) REFERENCES driver_profiles(id) ON DELETE CASCADE,
ADD CONSTRAINT fk_payments_eod_report FOREIGN KEY (eod_report_id) REFERENCES eod_reports(id) ON DELETE CASCADE,
ADD CONSTRAINT fk_payments_created_by FOREIGN KEY (created_by) REFERENCES profiles(user_id) ON DELETE CASCADE,
ADD CONSTRAINT fk_payments_exported_by FOREIGN KEY (exported_by) REFERENCES profiles(user_id) ON DELETE SET NULL;

ALTER TABLE profiles
ADD CONSTRAINT fk_profiles_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;

ALTER TABLE rounds
ADD CONSTRAINT fk_rounds_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE schedules
ADD CONSTRAINT fk_schedules_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
ADD CONSTRAINT fk_schedules_driver FOREIGN KEY (driver_id) REFERENCES driver_profiles(id) ON DELETE CASCADE,
ADD CONSTRAINT fk_schedules_round FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE,
ADD CONSTRAINT fk_schedules_created_by FOREIGN KEY (created_by) REFERENCES profiles(user_id) ON DELETE CASCADE;

ALTER TABLE sod_logs
ADD CONSTRAINT fk_sod_logs_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
ADD CONSTRAINT fk_sod_logs_driver FOREIGN KEY (driver_id) REFERENCES driver_profiles(id) ON DELETE CASCADE,
ADD CONSTRAINT fk_sod_logs_van FOREIGN KEY (van_id) REFERENCES vans(id) ON DELETE SET NULL;

ALTER TABLE vans
ADD CONSTRAINT fk_vans_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE vehicle_checks
ADD CONSTRAINT fk_vehicle_checks_van FOREIGN KEY (van_id) REFERENCES vans(id) ON DELETE CASCADE,
ADD CONSTRAINT fk_vehicle_checks_driver FOREIGN KEY (driver_id) REFERENCES driver_profiles(id) ON DELETE CASCADE;

ALTER TABLE announcements
ADD CONSTRAINT fk_announcements_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
ADD CONSTRAINT fk_announcements_created_by FOREIGN KEY (created_by) REFERENCES profiles(user_id) ON DELETE CASCADE;

-- 2. Add data validation constraints
ALTER TABLE driver_invitations
ADD CONSTRAINT chk_invitation_status CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
ADD CONSTRAINT chk_invitation_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
ADD CONSTRAINT chk_invitation_phone_format CHECK (phone IS NULL OR phone ~* '^\+?[1-9]\d{1,14}$'),
ADD CONSTRAINT chk_invitation_hourly_rate CHECK (hourly_rate IS NULL OR hourly_rate >= 0);

ALTER TABLE driver_profiles
ADD CONSTRAINT chk_driver_status CHECK (status IN ('pending', 'active', 'inactive', 'suspended')),
ADD CONSTRAINT chk_driver_hourly_rate CHECK (hourly_rate IS NULL OR hourly_rate >= 0),
ADD CONSTRAINT chk_driver_parcel_rate CHECK (parcel_rate IS NULL OR parcel_rate >= 0),
ADD CONSTRAINT chk_driver_license_expiry CHECK (license_expiry IS NULL OR license_expiry > CURRENT_DATE);

ALTER TABLE eod_reports
ADD CONSTRAINT chk_eod_status CHECK (status IN ('submitted', 'approved', 'rejected')),
ADD CONSTRAINT chk_eod_parcels_delivered CHECK (parcels_delivered >= 0),
ADD CONSTRAINT chk_eod_pay_amounts CHECK (
  (estimated_pay IS NULL OR estimated_pay >= 0) AND 
  (actual_pay IS NULL OR actual_pay >= 0)
);

ALTER TABLE incident_reports
ADD CONSTRAINT chk_incident_status CHECK (status IN ('reported', 'investigating', 'resolved', 'dismissed')),
ADD CONSTRAINT chk_incident_type CHECK (incident_type IN ('accident', 'theft', 'damage', 'safety', 'other'));

ALTER TABLE payments
ADD CONSTRAINT chk_payment_status CHECK (status IN ('calculated', 'approved', 'paid', 'disputed')),
ADD CONSTRAINT chk_payment_amounts CHECK (
  total_pay >= 0 AND 
  parcel_rate >= 0 AND 
  parcel_count >= 0 AND
  (base_pay IS NULL OR base_pay >= 0)
);

ALTER TABLE sod_logs
ADD CONSTRAINT chk_sod_parcel_count CHECK (parcel_count >= 0),
ADD CONSTRAINT chk_sod_mileage CHECK (starting_mileage >= 0);

ALTER TABLE vehicle_checks
ADD CONSTRAINT chk_vehicle_fuel_level CHECK (fuel_level IS NULL OR (fuel_level >= 0 AND fuel_level <= 100)),
ADD CONSTRAINT chk_vehicle_mileage CHECK (mileage IS NULL OR mileage >= 0),
ADD CONSTRAINT chk_vehicle_status CHECK (status IN ('completed', 'issues_found', 'failed'));

-- 3. Add indexes for performance and referential integrity
CREATE INDEX IF NOT EXISTS idx_daily_logs_driver_date ON daily_logs(driver_id, log_date);
CREATE INDEX IF NOT EXISTS idx_daily_logs_company_date ON daily_logs(company_id, log_date);
CREATE INDEX IF NOT EXISTS idx_driver_invitations_token ON driver_invitations(invite_token);
CREATE INDEX IF NOT EXISTS idx_driver_invitations_email ON driver_invitations(email);
CREATE INDEX IF NOT EXISTS idx_driver_profiles_company ON driver_profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_driver_profiles_user ON driver_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_eod_reports_driver_date ON eod_reports(driver_id, log_date);
CREATE INDEX IF NOT EXISTS idx_payments_driver_period ON payments(driver_id, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_schedules_driver_date ON schedules(driver_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_sod_logs_driver_date ON sod_logs(driver_id, log_date);

-- 4. Fix nullable foreign key fields that should be NOT NULL
ALTER TABLE driver_invitations ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE driver_invitations ALTER COLUMN created_by SET NOT NULL;
ALTER TABLE driver_profiles ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE driver_profiles ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE eod_reports ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE eod_reports ALTER COLUMN driver_id SET NOT NULL;
ALTER TABLE incident_reports ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE incident_reports ALTER COLUMN driver_id SET NOT NULL;
ALTER TABLE payments ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE payments ALTER COLUMN driver_id SET NOT NULL;
ALTER TABLE payments ALTER COLUMN created_by SET NOT NULL;
ALTER TABLE sod_logs ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE sod_logs ALTER COLUMN driver_id SET NOT NULL;
ALTER TABLE vehicle_checks ALTER COLUMN van_id SET NOT NULL;
ALTER TABLE vehicle_checks ALTER COLUMN driver_id SET NOT NULL;