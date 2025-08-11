-- Add missing RLS policies (skip ones that already exist)

-- Try to add profiles policy
DO $$ BEGIN
    CREATE POLICY "Admins can create driver profiles for their companies" 
    ON public.profiles 
    FOR INSERT 
    WITH CHECK (
      user_type = 'driver' AND 
      EXISTS (
        SELECT 1 FROM user_companies uc
        WHERE uc.user_id = auth.uid() 
        AND uc.role = 'admin'
      )
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Try to add driver profiles policies
DO $$ BEGIN
    CREATE POLICY "Admins can insert driver profiles for their companies" 
    ON public.driver_profiles 
    FOR INSERT 
    WITH CHECK (
      public.user_has_company_role(auth.uid(), company_id, 'admin')
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Admins can update driver profiles in their companies" 
    ON public.driver_profiles 
    FOR UPDATE 
    USING (
      public.user_has_company_role(auth.uid(), company_id, 'admin')
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Admins can view drivers in their companies" 
    ON public.driver_profiles 
    FOR SELECT 
    USING (
      user_id = auth.uid() OR 
      public.user_has_company_role(auth.uid(), company_id, 'admin')
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Try to add companies policies
DO $$ BEGIN
    CREATE POLICY "Admins can update companies they manage" 
    ON public.companies 
    FOR UPDATE 
    USING (
      public.user_has_company_role(auth.uid(), id, 'admin')
    )
    WITH CHECK (
      public.user_has_company_role(auth.uid(), id, 'admin')
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can view companies they belong to" 
    ON public.companies 
    FOR SELECT 
    USING (
      created_by = auth.uid() OR 
      public.user_has_company_role(auth.uid(), id)
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Try to add vans policies
DO $$ BEGIN
    CREATE POLICY "Company users can view vans in their companies" 
    ON public.vans 
    FOR SELECT 
    USING (
      public.user_has_company_role(auth.uid(), company_id)
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Admins can manage vans in their companies" 
    ON public.vans 
    FOR ALL 
    USING (
      public.user_has_company_role(auth.uid(), company_id, 'admin')
    )
    WITH CHECK (
      public.user_has_company_role(auth.uid(), company_id, 'admin')
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Try to add rounds policies  
DO $$ BEGIN
    CREATE POLICY "Admins can manage rounds in their companies" 
    ON public.rounds 
    FOR ALL 
    USING (
      public.user_has_company_role(auth.uid(), company_id, 'admin')
    )
    WITH CHECK (
      public.user_has_company_role(auth.uid(), company_id, 'admin')
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;