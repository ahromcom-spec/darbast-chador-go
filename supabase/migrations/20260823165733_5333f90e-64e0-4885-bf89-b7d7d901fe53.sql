CREATE TABLE IF NOT EXISTS public.sms_send_window (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  enabled boolean NOT NULL DEFAULT false,
  start_time text NOT NULL DEFAULT '09:00',
  end_time text NOT NULL DEFAULT '21:00',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT, INSERT, UPDATE ON public.sms_send_window TO authenticated;
GRANT SELECT ON public.sms_send_window TO anon;
GRANT ALL ON public.sms_send_window TO service_role;

ALTER TABLE public.sms_send_window ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sms_send_window_read" ON public.sms_send_window;
CREATE POLICY "sms_send_window_read" ON public.sms_send_window FOR SELECT USING (true);

DROP POLICY IF EXISTS "sms_send_window_manage" ON public.sms_send_window;
CREATE POLICY "sms_send_window_manage" ON public.sms_send_window FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'ceo')
  OR public.has_role(auth.uid(), 'general_manager') OR public.has_role(auth.uid(), 'operations_manager')
  OR public.has_role(auth.uid(), 'sales_manager') OR public.has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials')
  OR public.has_role(auth.uid(), 'scaffold_executive_manager') OR public.has_role(auth.uid(), 'rental_executive_manager')
  OR public.has_role(auth.uid(), 'finance_manager') OR public.has_role(auth.uid(), 'support_manager')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'ceo')
  OR public.has_role(auth.uid(), 'general_manager') OR public.has_role(auth.uid(), 'operations_manager')
  OR public.has_role(auth.uid(), 'sales_manager') OR public.has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials')
  OR public.has_role(auth.uid(), 'scaffold_executive_manager') OR public.has_role(auth.uid(), 'rental_executive_manager')
  OR public.has_role(auth.uid(), 'finance_manager') OR public.has_role(auth.uid(), 'support_manager')
);

INSERT INTO public.sms_send_window (id) VALUES (true) ON CONFLICT (id) DO NOTHING;