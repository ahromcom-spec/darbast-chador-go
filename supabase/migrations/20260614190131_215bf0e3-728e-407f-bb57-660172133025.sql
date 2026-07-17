
DROP POLICY IF EXISTS "Authenticated users can view order daily logs" ON public.order_daily_logs;
CREATE POLICY "Staff and order owner can view order daily logs"
ON public.order_daily_logs FOR SELECT TO authenticated
USING (
  created_by = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'ceo'::app_role)
  OR has_role(auth.uid(), 'general_manager'::app_role)
  OR has_role(auth.uid(), 'finance_manager'::app_role)
  OR has_role(auth.uid(), 'sales_manager'::app_role)
  OR has_role(auth.uid(), 'scaffold_executive_manager'::app_role)
  OR has_role(auth.uid(), 'rental_executive_manager'::app_role)
  OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_daily_logs.order_id AND o.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Authenticated users can view history" ON public.module_version_history;
CREATE POLICY "Admins CEO and savers can view version history"
ON public.module_version_history FOR SELECT TO authenticated
USING (
  saved_by = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'ceo'::app_role)
);

DROP POLICY IF EXISTS "Staff can view own salary settings" ON public.staff_salary_settings;
CREATE POLICY "Staff can view own salary settings"
ON public.staff_salary_settings FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND (
        p.phone_number = staff_salary_settings.staff_code
        OR staff_salary_settings.staff_code = SUBSTRING(p.phone_number FROM 2)
        OR p.phone_number = concat('0', staff_salary_settings.staff_code)
      )
  )
  OR EXISTS (
    SELECT 1 FROM public.hr_employees h
    WHERE h.user_id = auth.uid()
      AND h.phone_number = staff_salary_settings.staff_code
  )
);

DROP POLICY IF EXISTS "Authenticated users can submit media for approval" ON public.approved_media;
CREATE POLICY "Authenticated users can submit media for approval"
ON public.approved_media FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND uploaded_by = auth.uid());

DROP POLICY IF EXISTS "Staff can view all renewals" ON public.order_renewals;
DROP POLICY IF EXISTS "Staff can create renewals" ON public.order_renewals;
DROP POLICY IF EXISTS "Staff can update renewals" ON public.order_renewals;
DROP POLICY IF EXISTS "Staff can delete renewals" ON public.order_renewals;

CREATE OR REPLACE FUNCTION public.can_manage_order_renewals(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    has_role(_uid, 'admin'::app_role)
    OR has_role(_uid, 'ceo'::app_role)
    OR has_role(_uid, 'general_manager'::app_role)
    OR has_role(_uid, 'finance_manager'::app_role)
    OR has_role(_uid, 'sales_manager'::app_role)
    OR has_role(_uid, 'scaffold_executive_manager'::app_role)
    OR has_role(_uid, 'rental_executive_manager'::app_role)
    OR has_role(_uid, 'executive_manager_scaffold_execution_with_materials'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.module_assignments ma
      WHERE ma.assigned_user_id = _uid
        AND ma.is_active = true
        AND ma.module_key IN ('finance','sales','executive','daily_report','rental_executive','scaffold_executive','order_renewals')
    );
$$;

CREATE POLICY "Staff can view all renewals" ON public.order_renewals
FOR SELECT TO authenticated USING (public.can_manage_order_renewals(auth.uid()));
CREATE POLICY "Staff can create renewals" ON public.order_renewals
FOR INSERT TO authenticated WITH CHECK (public.can_manage_order_renewals(auth.uid()));
CREATE POLICY "Staff can update renewals" ON public.order_renewals
FOR UPDATE TO authenticated USING (public.can_manage_order_renewals(auth.uid())) WITH CHECK (public.can_manage_order_renewals(auth.uid()));
CREATE POLICY "Staff can delete renewals" ON public.order_renewals
FOR DELETE TO authenticated USING (public.can_manage_order_renewals(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can upload voice messages" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload voice messages" ON storage.objects;
CREATE POLICY "Users can upload voice messages to own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'voice-messages'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
