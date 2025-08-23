-- Continue Optimization: Performance Indexes and Remaining Function Fixes

-- 1. Add Performance Indexes for Common Query Patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_companies_user_role 
ON user_companies(user_id, company_id, role);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_driver_profiles_user_id 
ON driver_profiles(user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_driver_profiles_company_id 
ON driver_profiles(company_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_location_points_driver_timestamp 
ON location_points(driver_id, timestamp DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_location_points_company_timestamp 
ON location_points(company_id, timestamp DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_eod_reports_driver_date 
ON end_of_day_reports(driver_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sod_reports_driver_date 
ON start_of_day_reports(driver_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_driver_period 
ON payments(driver_id, period_start, period_end);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_driver_shifts_driver_date 
ON driver_shifts(driver_id, start_time DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_company_timestamp 
ON messages(company_id, created_at DESC);

-- 2. Add Data Validation Constraints
ALTER TABLE driver_ratings 
ADD CONSTRAINT chk_driver_ratings_valid_scores 
CHECK (
  overall_rating >= 1.0 AND overall_rating <= 5.0 AND
  punctuality >= 1 AND punctuality <= 5 AND
  communication >= 1 AND communication <= 5 AND
  customer_service >= 1 AND customer_service <= 5 AND
  vehicle_care >= 1 AND vehicle_care <= 5
);

ALTER TABLE route_feedback 
ADD CONSTRAINT chk_route_feedback_valid_ratings 
CHECK (
  (route_difficulty IS NULL OR (route_difficulty >= 1 AND route_difficulty <= 5)) AND
  (traffic_rating IS NULL OR (traffic_rating >= 1 AND traffic_rating <= 5)) AND
  (depot_experience IS NULL OR (depot_experience >= 1 AND depot_experience <= 5))
);

ALTER TABLE payments 
ADD CONSTRAINT chk_payments_positive_amounts 
CHECK (
  total_pay >= 0 AND
  parcel_count >= 0 AND
  parcel_rate >= 0 AND
  (base_pay IS NULL OR base_pay >= 0)
);

ALTER TABLE driver_expenses 
ADD CONSTRAINT chk_driver_expenses_positive_amount 
CHECK (amount >= 0);

ALTER TABLE operating_costs 
ADD CONSTRAINT chk_operating_costs_positive_amount 
CHECK (amount >= 0);