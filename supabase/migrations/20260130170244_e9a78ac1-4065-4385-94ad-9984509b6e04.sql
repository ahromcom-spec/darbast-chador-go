-- Allow users with daily_report module access to update bank card balances
CREATE POLICY "Daily report users can update bank card balances"
ON public.bank_cards
FOR UPDATE
USING (
  (EXISTS ( SELECT 1
   FROM module_assignments
   WHERE module_assignments.assigned_user_id = auth.uid()
   AND module_assignments.module_key = 'daily_report'
   AND module_assignments.is_active = true))
)
WITH CHECK (
  (EXISTS ( SELECT 1
   FROM module_assignments
   WHERE module_assignments.assigned_user_id = auth.uid()
   AND module_assignments.module_key = 'daily_report'
   AND module_assignments.is_active = true))
);