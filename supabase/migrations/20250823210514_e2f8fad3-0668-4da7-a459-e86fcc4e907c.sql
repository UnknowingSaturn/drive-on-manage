-- Fix security settings for the invoice functions
CREATE OR REPLACE FUNCTION calculate_driver_invoice_data(
  driver_id_param UUID,
  period_start DATE,
  period_end DATE
)
RETURNS TABLE(
  total_parcels INTEGER,
  parcel_rate NUMERIC,
  total_amount NUMERIC
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(eod.successful_deliveries + eod.successful_collections), 0)::INTEGER as total_parcels,
    COALESCE(dp.parcel_rate, 0.75) as parcel_rate,
    (COALESCE(SUM(eod.successful_deliveries + eod.successful_collections), 0) * COALESCE(dp.parcel_rate, 0.75))::NUMERIC as total_amount
  FROM driver_profiles dp
  LEFT JOIN end_of_day_reports eod ON eod.driver_id = dp.id 
    AND eod.created_at::date >= period_start 
    AND eod.created_at::date <= period_end
  WHERE dp.id = driver_id_param
  GROUP BY dp.id, dp.parcel_rate;
END;
$$;

-- Fix security settings for invoice number generation
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  next_number INTEGER;
  invoice_number TEXT;
BEGIN
  -- Get the next invoice number based on existing invoices
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM '[0-9]+') AS INTEGER)), 0) + 1
  INTO next_number
  FROM driver_invoices
  WHERE invoice_number ~ '^INV-[0-9]+$';
  
  -- Generate the invoice number with format INV-000001
  invoice_number := 'INV-' || LPAD(next_number::TEXT, 6, '0');
  
  RETURN invoice_number;
END;
$$;