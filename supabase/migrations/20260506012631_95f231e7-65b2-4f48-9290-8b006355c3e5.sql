DROP POLICY IF EXISTS "Authorized roles can insert bank card transactions" ON public.bank_card_transactions;
DROP POLICY IF EXISTS "Authorized users can view bank card transactions" ON public.bank_card_transactions;
DROP POLICY IF EXISTS "Authorized users can insert bank card transactions" ON public.bank_card_transactions;

CREATE POLICY "Authorized users can view bank card transactions"
ON public.bank_card_transactions
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'ceo'::public.app_role)
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'general_manager'::public.app_role)
  OR public.has_role(auth.uid(), 'finance_manager'::public.app_role)
  OR EXISTS (
    SELECT 1
    FROM public.module_assignments ma
    WHERE ma.assigned_user_id = auth.uid()
      AND ma.is_active = true
      AND ma.module_key IN ('bank_cards', 'daily_report')
  )
);

CREATE POLICY "Authorized users can insert bank card transactions"
ON public.bank_card_transactions
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'ceo'::public.app_role)
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'general_manager'::public.app_role)
  OR public.has_role(auth.uid(), 'finance_manager'::public.app_role)
  OR EXISTS (
    SELECT 1
    FROM public.module_assignments ma
    WHERE ma.assigned_user_id = auth.uid()
      AND ma.is_active = true
      AND ma.module_key IN ('bank_cards', 'daily_report')
  )
);