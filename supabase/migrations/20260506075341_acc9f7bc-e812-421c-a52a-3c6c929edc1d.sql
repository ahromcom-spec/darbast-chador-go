CREATE POLICY "Authorized users can update bank card transactions"
ON public.bank_card_transactions
FOR UPDATE
USING (
  has_role(auth.uid(), 'ceo'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'general_manager'::app_role)
  OR has_role(auth.uid(), 'finance_manager'::app_role)
  OR EXISTS (
    SELECT 1 FROM module_assignments ma
    WHERE ma.assigned_user_id = auth.uid()
      AND ma.is_active = true
      AND ma.module_key = ANY (ARRAY['bank_cards'::text, 'daily_report'::text])
  )
)
WITH CHECK (
  has_role(auth.uid(), 'ceo'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'general_manager'::app_role)
  OR has_role(auth.uid(), 'finance_manager'::app_role)
  OR EXISTS (
    SELECT 1 FROM module_assignments ma
    WHERE ma.assigned_user_id = auth.uid()
      AND ma.is_active = true
      AND ma.module_key = ANY (ARRAY['bank_cards'::text, 'daily_report'::text])
  )
);