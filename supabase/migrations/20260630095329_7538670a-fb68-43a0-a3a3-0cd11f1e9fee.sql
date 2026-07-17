-- Allow CEO and general_manager to read SMS logs (currently only admin can)
DROP POLICY IF EXISTS "Admins read sms logs" ON public.sms_logs;
CREATE POLICY "Managers read sms logs"
ON public.sms_logs
FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'ceo'::app_role)
  OR public.has_role(auth.uid(), 'general_manager'::app_role)
);