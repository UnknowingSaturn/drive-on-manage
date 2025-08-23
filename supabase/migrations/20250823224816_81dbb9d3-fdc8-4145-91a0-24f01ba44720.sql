-- Expand driver_invoices table to support detailed invoice structure
ALTER TABLE public.driver_invoices 
ADD COLUMN base_parcels INTEGER DEFAULT 0,
ADD COLUMN base_rate NUMERIC DEFAULT 0,
ADD COLUMN base_total NUMERIC DEFAULT 0,
ADD COLUMN cover_parcels INTEGER DEFAULT 0,
ADD COLUMN cover_rate NUMERIC DEFAULT 0,
ADD COLUMN cover_total NUMERIC DEFAULT 0,
ADD COLUMN support_parcels INTEGER DEFAULT 0,
ADD COLUMN support_rate NUMERIC DEFAULT 0,
ADD COLUMN support_total NUMERIC DEFAULT 0,
ADD COLUMN bonus_payments JSONB DEFAULT '[]'::jsonb,
ADD COLUMN deductions JSONB DEFAULT '[]'::jsonb,
ADD COLUMN total_deductions NUMERIC DEFAULT 0,
ADD COLUMN working_days INTEGER DEFAULT 0,
ADD COLUMN period_description TEXT;

-- Update existing invoices to populate new fields from existing data
UPDATE public.driver_invoices 
SET 
  base_parcels = total_parcels,
  base_rate = parcel_rate,
  base_total = total_amount,
  period_description = CONCAT('Delivery (', 
    TO_CHAR(billing_period_start, 'Day DD Mon'), 
    ' - ', 
    TO_CHAR(billing_period_end, 'Day DD Mon YYYY'), 
    ')')
WHERE base_parcels IS NULL;