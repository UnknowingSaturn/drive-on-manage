-- Fix ambiguous column reference in generate_invoice_number function
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
  -- Fully qualify the column name to avoid ambiguity
  SELECT COALESCE(MAX(CAST(SUBSTRING(di.invoice_number FROM '[0-9]+') AS INTEGER)), 0) + 1
  INTO next_number
  FROM driver_invoices di
  WHERE di.invoice_number ~ '^INV-[0-9]+$';
  
  -- Generate the invoice number with format INV-000001
  invoice_number := 'INV-' || LPAD(next_number::TEXT, 6, '0');
  
  RETURN invoice_number;
END;
$$;