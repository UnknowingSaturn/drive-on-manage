-- Fix security warnings by setting search_path on the function
DROP FUNCTION IF EXISTS get_monthly_pnl(uuid, date, date);

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
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

-- Remove materialized view from API access
REVOKE ALL ON mv_monthly_pnl FROM anon, authenticated;