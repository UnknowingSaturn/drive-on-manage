-- Fix the generate_invoice_number function to avoid ambiguous column reference
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_year TEXT;
  current_month TEXT;
  next_number INTEGER;
  invoice_number_result TEXT;
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
  current_month := LPAD(EXTRACT(MONTH FROM CURRENT_DATE)::TEXT, 2, '0');
  
  -- Get the next invoice number for this month
  SELECT COALESCE(MAX(
    CASE 
      WHEN di.invoice_number ~ ('^INV-' || current_year || current_month || '-[0-9]+$')
      THEN CAST(SUBSTRING(di.invoice_number FROM '[0-9]+$') AS INTEGER)
      ELSE 0
    END
  ), 0) + 1
  INTO next_number
  FROM driver_invoices di
  WHERE di.invoice_number LIKE 'INV-' || current_year || current_month || '-%';
  
  invoice_number_result := 'INV-' || current_year || current_month || '-' || LPAD(next_number::TEXT, 4, '0');
  
  RETURN invoice_number_result;
END;
$function$