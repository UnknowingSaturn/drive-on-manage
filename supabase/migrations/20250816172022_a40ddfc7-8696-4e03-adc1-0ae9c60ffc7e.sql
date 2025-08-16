-- Add missing policies for announcements table
CREATE POLICY "Users can view announcements for their companies" 
ON public.announcements 
FOR SELECT 
USING (
  company_id IN (
    SELECT company_id 
    FROM user_companies 
    WHERE user_id = auth.uid()
  ) 
  AND is_active = true
);

-- Add policy for drivers to view rounds they're scheduled for
CREATE POLICY "Drivers can view rounds they are scheduled for" 
ON public.rounds 
FOR SELECT 
USING (
  id IN (
    SELECT round_id 
    FROM schedules 
    WHERE driver_id IN (
      SELECT id 
      FROM driver_profiles 
      WHERE user_id = auth.uid()
    )
  )
);