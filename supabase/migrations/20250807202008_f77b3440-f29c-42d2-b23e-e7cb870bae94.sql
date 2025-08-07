-- Create RLS policies for company management
-- Allow admins to insert new companies
CREATE POLICY "Admins can insert companies" 
ON companies 
FOR INSERT 
TO authenticated 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.user_type = 'admin'
  )
);

-- Allow admins to update companies in their own company
CREATE POLICY "Admins can update their company" 
ON companies 
FOR UPDATE 
TO authenticated 
USING (
  id IN (
    SELECT profiles.company_id
    FROM profiles
    WHERE profiles.user_id = auth.uid() 
    AND profiles.user_type = 'admin'
  )
)
WITH CHECK (
  id IN (
    SELECT profiles.company_id
    FROM profiles
    WHERE profiles.user_id = auth.uid() 
    AND profiles.user_type = 'admin'
  )
);

-- Allow super admins to delete companies (be careful with this)
CREATE POLICY "Super admins can delete companies" 
ON companies 
FOR DELETE 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.user_type = 'admin'
    -- Add additional super admin check if needed
  )
);