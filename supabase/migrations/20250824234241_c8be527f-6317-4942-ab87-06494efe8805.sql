-- Update the RLS policy on vans table to allow drivers to see vans from their company
-- Drop the existing policy
DROP POLICY IF EXISTS "Users can view vans" ON public.vans;

-- Create new policy that allows both admin users and drivers to see vans
CREATE POLICY "Users can view vans" ON public.vans
  FOR SELECT
  USING (
    company_id IN (
      -- Allow admin users from user_companies
      SELECT uc.company_id
      FROM user_companies uc
      WHERE uc.user_id = auth.uid()
    )
    OR
    company_id IN (
      -- Allow drivers from driver_profiles
      SELECT dp.company_id
      FROM driver_profiles dp
      WHERE dp.user_id = auth.uid()
    )
  );