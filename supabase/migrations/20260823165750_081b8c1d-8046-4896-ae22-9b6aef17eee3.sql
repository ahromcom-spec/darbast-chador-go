REVOKE SELECT ON public.sms_send_window FROM anon;
DROP POLICY IF EXISTS "sms_send_window_read" ON public.sms_send_window;
CREATE POLICY "sms_send_window_read" ON public.sms_send_window FOR SELECT TO authenticated USING (true);