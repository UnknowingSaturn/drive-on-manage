-- Create driver_invoices table
CREATE TABLE public.driver_invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_number text NOT NULL UNIQUE,
  driver_id uuid NOT NULL,
  company_id uuid NOT NULL,
  billing_period_start date NOT NULL,
  billing_period_end date NOT NULL,
  total_parcels integer NOT NULL DEFAULT 0,
  parcel_rate numeric(10,2) NOT NULL DEFAULT 0,
  total_amount numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  generated_by uuid NOT NULL,
  sent_at timestamp with time zone,
  paid_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create operating_costs table
CREATE TABLE public.operating_costs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL,
  date date NOT NULL,
  category text NOT NULL,
  description text NOT NULL,
  amount numeric(10,2) NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.driver_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operating_costs ENABLE ROW LEVEL SECURITY;

-- RLS policies for driver_invoices
CREATE POLICY "Admins can manage invoices in their company" 
ON public.driver_invoices FOR ALL 
USING (company_id IN (
  SELECT profiles.company_id FROM profiles 
  WHERE profiles.user_id = auth.uid() AND profiles.user_type = 'admin'
))
WITH CHECK (company_id IN (
  SELECT profiles.company_id FROM profiles 
  WHERE profiles.user_id = auth.uid() AND profiles.user_type = 'admin'
));

CREATE POLICY "Drivers can view their own invoices" 
ON public.driver_invoices FOR SELECT 
USING (driver_id IN (
  SELECT driver_profiles.id FROM driver_profiles 
  WHERE driver_profiles.user_id = auth.uid()
));

-- RLS policies for operating_costs
CREATE POLICY "Admins can manage operating costs in their company" 
ON public.operating_costs FOR ALL 
USING (company_id IN (
  SELECT profiles.company_id FROM profiles 
  WHERE profiles.user_id = auth.uid() AND profiles.user_type = 'admin'
))
WITH CHECK (company_id IN (
  SELECT profiles.company_id FROM profiles 
  WHERE profiles.user_id = auth.uid() AND profiles.user_type = 'admin'
));

-- Create functions for invoice management
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  current_year TEXT;
  current_month TEXT;
  next_number INTEGER;
  invoice_number TEXT;
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
  current_month := LPAD(EXTRACT(MONTH FROM CURRENT_DATE)::TEXT, 2, '0');
  
  -- Get the next invoice number for this month
  SELECT COALESCE(MAX(
    CASE 
      WHEN invoice_number ~ ('^INV-' || current_year || current_month || '-[0-9]+$')
      THEN CAST(SUBSTRING(invoice_number FROM '[0-9]+$') AS INTEGER)
      ELSE 0
    END
  ), 0) + 1
  INTO next_number
  FROM driver_invoices
  WHERE invoice_number LIKE 'INV-' || current_year || current_month || '-%';
  
  invoice_number := 'INV-' || current_year || current_month || '-' || LPAD(next_number::TEXT, 4, '0');
  
  RETURN invoice_number;
END;
$$;

-- Create function to calculate driver invoice data
CREATE OR REPLACE FUNCTION public.calculate_driver_invoice_data(
  driver_id_param uuid,
  period_start date,
  period_end date
)
RETURNS TABLE(
  total_parcels integer,
  parcel_rate numeric,
  total_amount numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  driver_rate NUMERIC;
  parcel_count INTEGER;
  calculated_amount NUMERIC;
BEGIN
  -- Get driver's current parcel rate
  SELECT dp.parcel_rate INTO driver_rate
  FROM driver_profiles dp
  WHERE dp.id = driver_id_param;
  
  -- Calculate total parcels delivered in the period
  SELECT COALESCE(SUM(eod.parcels_delivered), 0) INTO parcel_count
  FROM eod_reports eod
  WHERE eod.driver_id = driver_id_param
  AND eod.log_date >= period_start
  AND eod.log_date <= period_end
  AND eod.status = 'approved';
  
  -- Calculate total amount
  calculated_amount := parcel_count * COALESCE(driver_rate, 0);
  
  RETURN QUERY SELECT parcel_count, COALESCE(driver_rate, 0), calculated_amount;
END;
$$;

-- Add updated_at trigger
CREATE TRIGGER update_driver_invoices_updated_at
  BEFORE UPDATE ON public.driver_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_operating_costs_updated_at
  BEFORE UPDATE ON public.operating_costs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();