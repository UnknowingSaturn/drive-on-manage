-- Add location consent and coordinates columns to driver_shifts table
ALTER TABLE public.driver_shifts 
ADD COLUMN IF NOT EXISTS location_consent boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS start_lat numeric,
ADD COLUMN IF NOT EXISTS start_lng numeric,
ADD COLUMN IF NOT EXISTS start_accuracy_m numeric;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_driver_shifts_driver_started_at 
ON public.driver_shifts (driver_id, start_time DESC);

-- Add finance performance indexes
CREATE INDEX IF NOT EXISTS idx_driver_invoices_company_month 
ON public.driver_invoices (company_id, extract(year from billing_period_start), extract(month from billing_period_start));

CREATE INDEX IF NOT EXISTS idx_operating_costs_company_date 
ON public.operating_costs (company_id, date);

CREATE INDEX IF NOT EXISTS idx_company_revenue_company_date 
ON public.company_revenue (company_id, date);

-- Create materialized view for monthly P&L
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_monthly_pnl AS
SELECT 
  company_id,
  extract(year from date) as year,
  extract(month from date) as month,
  'revenue'::text as type,
  SUM(total_amount) as amount
FROM company_revenue 
GROUP BY company_id, extract(year from date), extract(month from date)

UNION ALL

SELECT 
  company_id,
  extract(year from date) as year,
  extract(month from date) as month,
  'expense'::text as type,
  -SUM(amount) as amount
FROM operating_costs 
GROUP BY company_id, extract(year from date), extract(month from date);

-- Create unique index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_monthly_pnl_unique 
ON mv_monthly_pnl (company_id, year, month, type);

-- Create function to get monthly P&L
CREATE OR REPLACE FUNCTION get_monthly_pnl(
  p_company_id uuid,
  p_from_date date,
  p_to_date date
) RETURNS TABLE (
  year integer,
  month integer,
  revenue numeric,
  expenses numeric,
  profit numeric
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  WITH monthly_data AS (
    SELECT 
      mv.year,
      mv.month,
      SUM(CASE WHEN mv.type = 'revenue' THEN mv.amount ELSE 0 END) as revenue,
      SUM(CASE WHEN mv.type = 'expense' THEN mv.amount ELSE 0 END) as expenses
    FROM mv_monthly_pnl mv
    WHERE mv.company_id = p_company_id
      AND make_date(mv.year::int, mv.month::int, 1) >= p_from_date
      AND make_date(mv.year::int, mv.month::int, 1) <= p_to_date
    GROUP BY mv.year, mv.month
  )
  SELECT 
    md.year::integer,
    md.month::integer,
    md.revenue,
    ABS(md.expenses) as expenses,
    (md.revenue + md.expenses) as profit
  FROM monthly_data md
  ORDER BY md.year DESC, md.month DESC;
END;
$$;