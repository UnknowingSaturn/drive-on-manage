-- Update the generate_invoice_number function to remove INV prefix
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  next_number INTEGER;
  invoice_number TEXT;
BEGIN
  -- Get the next invoice number based on existing invoices
  -- Look for numeric patterns instead of INV- prefix
  SELECT COALESCE(MAX(CASE WHEN di.invoice_number ~ '^[0-9]+$' 
                          THEN CAST(di.invoice_number AS INTEGER) 
                          ELSE 0 END), 0) + 1
  INTO next_number
  FROM driver_invoices di;
  
  -- Generate the invoice number with format 000001 (6 digits)
  invoice_number := LPAD(next_number::TEXT, 6, '0');
  
  RETURN invoice_number;
END;
$function$;