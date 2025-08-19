-- Create company revenue tracking table
CREATE TABLE public.company_revenue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  parcel_type TEXT NOT NULL,
  description TEXT,
  rate_per_parcel NUMERIC NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.company_revenue ENABLE ROW LEVEL SECURITY;

-- Create policies for company revenue
CREATE POLICY "Admins can manage company revenue for their companies" 
ON public.company_revenue FOR ALL 
USING (
  company_id IN (
    SELECT company_id FROM user_companies 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  company_id IN (
    SELECT company_id FROM user_companies 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Create updated_at trigger
CREATE TRIGGER update_company_revenue_updated_at
  BEFORE UPDATE ON public.company_revenue
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();