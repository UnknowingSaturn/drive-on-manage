-- Restore all removed indexes

-- Recreate all the indexes that were dropped in the previous migration
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_locked ON public.payments(locked);
CREATE INDEX IF NOT EXISTS idx_operating_costs_category ON public.operating_costs(category);
CREATE INDEX IF NOT EXISTS idx_rounds_road_lists ON public.rounds USING GIN(road_lists);
CREATE INDEX IF NOT EXISTS idx_route_feedback_date ON public.route_feedback(feedback_date);
CREATE INDEX IF NOT EXISTS idx_driver_achievements_type ON public.driver_achievements(achievement_type);
CREATE INDEX IF NOT EXISTS idx_driver_expenses_driver_id ON public.driver_expenses(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_expenses_date ON public.driver_expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_driver_earnings_driver_id ON public.driver_earnings(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_earnings_date ON public.driver_earnings(earning_date);
CREATE INDEX IF NOT EXISTS idx_messages_company_created ON public.messages(company_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_driver_ratings_company ON public.driver_ratings(company_id);
CREATE INDEX IF NOT EXISTS idx_location_points_shift_id ON public.location_points(shift_id);
CREATE INDEX IF NOT EXISTS idx_driver_shifts_driver_status ON public.driver_shifts(driver_id, status);
CREATE INDEX IF NOT EXISTS idx_location_stats_driver_date ON public.location_stats_daily(driver_id, stat_date);
CREATE INDEX IF NOT EXISTS idx_driver_invoices_company_month ON public.driver_invoices(company_id, billing_period_start);