
ALTER TABLE public.sms_templates
  ADD COLUMN IF NOT EXISTS delay_minutes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS footer text NOT NULL DEFAULT 'ahrom.ir',
  ADD COLUMN IF NOT EXISTS append_footer boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS default_template text;

UPDATE public.sms_templates SET default_template = template WHERE default_template IS NULL;

CREATE TABLE IF NOT EXISTS public.sms_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text,
  scope text,
  recipient text NOT NULL,
  message text NOT NULL,
  status text NOT NULL,
  provider_response text,
  order_id uuid,
  order_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.sms_logs TO authenticated;
GRANT ALL ON public.sms_logs TO service_role;

ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read sms logs"
  ON public.sms_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "service role manages sms logs"
  ON public.sms_logs FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_sms_logs_created_at ON public.sms_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_logs_recipient ON public.sms_logs (recipient);
