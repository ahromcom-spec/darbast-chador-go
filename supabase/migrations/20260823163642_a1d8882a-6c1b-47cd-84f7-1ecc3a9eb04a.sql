CREATE TABLE public.scheduled_sms (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone text NOT NULL,
  order_code text NOT NULL,
  order_id uuid,
  status_key text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  send_after timestamptz NOT NULL DEFAULT now(),
  state text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  sent_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scheduled_sms TO authenticated;
GRANT ALL ON public.scheduled_sms TO service_role;

ALTER TABLE public.scheduled_sms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view scheduled sms" ON public.scheduled_sms
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can schedule sms" ON public.scheduled_sms
FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Managers can cancel scheduled sms" ON public.scheduled_sms
FOR DELETE TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'ceo') OR created_by = auth.uid()
);

CREATE INDEX idx_scheduled_sms_due ON public.scheduled_sms (state, send_after);