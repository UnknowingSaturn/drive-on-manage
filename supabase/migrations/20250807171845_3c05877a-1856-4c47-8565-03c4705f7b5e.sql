-- Create payments table for managing driver compensation
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  driver_id UUID NOT NULL,
  eod_report_id UUID NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  base_pay NUMERIC(10,2) DEFAULT 0,
  parcel_count INTEGER NOT NULL DEFAULT 0,
  parcel_rate NUMERIC(8,2) NOT NULL,
  total_pay NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'calculated',
  locked BOOLEAN NOT NULL DEFAULT false,
  manually_adjusted BOOLEAN NOT NULL DEFAULT false,
  admin_notes TEXT,
  exported_at TIMESTAMP WITH TIME ZONE,
  exported_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  
  CONSTRAINT fk_payments_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT fk_payments_driver FOREIGN KEY (driver_id) REFERENCES driver_profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_payments_eod_report FOREIGN KEY (eod_report_id) REFERENCES eod_reports(id) ON DELETE CASCADE,
  CONSTRAINT valid_status CHECK (status IN ('calculated', 'approved', 'paid', 'disputed')),
  CONSTRAINT positive_amounts CHECK (base_pay >= 0 AND total_pay >= 0 AND parcel_rate >= 0)
);

-- Enable RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- RLS policies for payments
CREATE POLICY "Admins can manage payments in their company"
ON public.payments
FOR ALL
TO authenticated
USING (company_id IN (
  SELECT company_id FROM profiles 
  WHERE user_id = auth.uid() AND user_type = 'admin'
))
WITH CHECK (company_id IN (
  SELECT company_id FROM profiles 
  WHERE user_id = auth.uid() AND user_type = 'admin'
));

CREATE POLICY "Drivers can view their own payments"
ON public.payments
FOR SELECT
TO authenticated
USING (driver_id IN (
  SELECT id FROM driver_profiles 
  WHERE user_id = auth.uid()
));

-- Create trigger for updated_at
CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_payments_company_period ON public.payments(company_id, period_start, period_end);
CREATE INDEX idx_payments_driver_period ON public.payments(driver_id, period_start, period_end);
CREATE INDEX idx_payments_status ON public.payments(status);
CREATE INDEX idx_payments_locked ON public.payments(locked);

-- Create a view for payment summaries
CREATE OR REPLACE VIEW public.payment_summaries AS
SELECT 
  p.company_id,
  p.driver_id,
  dp.profiles->>'first_name' as driver_first_name,
  dp.profiles->>'last_name' as driver_last_name,
  DATE_TRUNC('week', p.period_start) as week_start,
  DATE_TRUNC('month', p.period_start) as month_start,
  COUNT(*) as total_reports,
  SUM(p.parcel_count) as total_parcels,
  SUM(p.base_pay) as total_base_pay,
  SUM(p.total_pay) as total_payment,
  AVG(p.parcel_rate) as avg_parcel_rate,
  COUNT(CASE WHEN p.locked THEN 1 END) as locked_reports,
  COUNT(CASE WHEN p.manually_adjusted THEN 1 END) as adjusted_reports
FROM public.payments p
LEFT JOIN public.driver_profiles dp ON p.driver_id = dp.id
GROUP BY 
  p.company_id, 
  p.driver_id, 
  dp.profiles->>'first_name',
  dp.profiles->>'last_name',
  DATE_TRUNC('week', p.period_start),
  DATE_TRUNC('month', p.period_start);