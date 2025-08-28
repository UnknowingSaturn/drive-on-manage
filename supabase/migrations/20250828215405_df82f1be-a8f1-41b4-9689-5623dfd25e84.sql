-- Fix RLS policy performance issue on vans table
-- Replace auth.uid() calls with (SELECT auth.uid()) to prevent re-evaluation for each row

DROP POLICY IF EXISTS "Users can view vans" ON public.vans;

CREATE POLICY "Users can view vans" ON public.vans
FOR SELECT 
USING (
  (company_id IN ( 
    SELECT uc.company_id
    FROM user_companies uc
    WHERE (uc.user_id = (SELECT auth.uid()))
  )) OR (company_id IN ( 
    SELECT dp.company_id
    FROM driver_profiles dp
    WHERE (dp.user_id = (SELECT auth.uid()))
  ))
);