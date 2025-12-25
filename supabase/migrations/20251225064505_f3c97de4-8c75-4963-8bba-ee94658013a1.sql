-- Allow managers (role-based) and approved internal staff to insert/view manual order payments

DROP POLICY IF EXISTS "Staff can insert order payments" ON public.order_payments;
DROP POLICY IF EXISTS "Staff can view all order payments" ON public.order_payments;

CREATE POLICY "Staff and managers can insert order payments"
ON public.order_payments
FOR INSERT
TO authenticated
WITH CHECK (
  (
    EXISTS (
      SELECT 1
      FROM public.internal_staff_profiles isp
      WHERE isp.user_id = auth.uid()
        AND isp.status = 'approved'::text
    )
  )
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'general_manager'::public.app_role)
  OR public.has_role(auth.uid(), 'ceo'::public.app_role)
  OR public.has_role(auth.uid(), 'sales_manager'::public.app_role)
  OR public.has_role(auth.uid(), 'finance_manager'::public.app_role)
  OR public.has_role(auth.uid(), 'scaffold_executive_manager'::public.app_role)
  OR public.has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::public.app_role)
  OR public.has_role(auth.uid(), 'rental_executive_manager'::public.app_role)
);

CREATE POLICY "Staff and managers can view all order payments"
ON public.order_payments
FOR SELECT
TO authenticated
USING (
  (
    EXISTS (
      SELECT 1
      FROM public.internal_staff_profiles isp
      WHERE isp.user_id = auth.uid()
        AND isp.status = 'approved'::text
    )
  )
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'general_manager'::public.app_role)
  OR public.has_role(auth.uid(), 'ceo'::public.app_role)
  OR public.has_role(auth.uid(), 'sales_manager'::public.app_role)
  OR public.has_role(auth.uid(), 'finance_manager'::public.app_role)
  OR public.has_role(auth.uid(), 'scaffold_executive_manager'::public.app_role)
  OR public.has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::public.app_role)
  OR public.has_role(auth.uid(), 'rental_executive_manager'::public.app_role)
);
