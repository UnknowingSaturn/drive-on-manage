-- Create RLS policies for driver_invoices table to allow admin operations
-- Admins can insert invoices for their company
CREATE POLICY "Admins can insert invoices for their company" 
ON driver_invoices 
FOR INSERT 
WITH CHECK (
  company_id IN (
    SELECT user_companies.company_id
    FROM user_companies
    WHERE user_companies.user_id = auth.uid() 
    AND user_companies.role = 'admin'
  )
);

-- Admins can update invoices for their company
CREATE POLICY "Admins can update invoices for their company" 
ON driver_invoices 
FOR UPDATE 
USING (
  company_id IN (
    SELECT user_companies.company_id
    FROM user_companies
    WHERE user_companies.user_id = auth.uid() 
    AND user_companies.role = 'admin'
  )
)
WITH CHECK (
  company_id IN (
    SELECT user_companies.company_id
    FROM user_companies
    WHERE user_companies.user_id = auth.uid() 
    AND user_companies.role = 'admin'
  )
);

-- Admins can view invoices for their company
CREATE POLICY "Admins can view invoices for their company" 
ON driver_invoices 
FOR SELECT 
USING (
  company_id IN (
    SELECT user_companies.company_id
    FROM user_companies
    WHERE user_companies.user_id = auth.uid() 
    AND user_companies.role = 'admin'
  )
);

-- Admins can delete invoices for their company
CREATE POLICY "Admins can delete invoices for their company" 
ON driver_invoices 
FOR DELETE 
USING (
  company_id IN (
    SELECT user_companies.company_id
    FROM user_companies
    WHERE user_companies.user_id = auth.uid() 
    AND user_companies.role = 'admin'
  )
);