ALTER TABLE public.sms_templates
  ADD COLUMN IF NOT EXISTS recipient_kinds text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS recipient_roles text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS recipient_phones text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS sms_templates_scope_stage_idx ON public.sms_templates (scope, stage_key);

CREATE TABLE IF NOT EXISTS public.sms_dispatch_claims (
  claim_key text PRIMARY KEY,
  claimed_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.sms_dispatch_claims TO service_role;
ALTER TABLE public.sms_dispatch_claims ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.claim_sms_dispatch(_key text, _window_seconds integer DEFAULT 180)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ok boolean;
BEGIN
  INSERT INTO public.sms_dispatch_claims (claim_key, claimed_at)
  VALUES (_key, now())
  ON CONFLICT (claim_key) DO UPDATE SET claimed_at = now()
    WHERE public.sms_dispatch_claims.claimed_at < now() - make_interval(secs => GREATEST(_window_seconds, 1))
  RETURNING true INTO ok;
  IF random() < 0.02 THEN
    DELETE FROM public.sms_dispatch_claims WHERE claimed_at < now() - interval '3 days';
  END IF;
  RETURN COALESCE(ok, false);
END;
$$;
REVOKE ALL ON FUNCTION public.claim_sms_dispatch(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_sms_dispatch(text, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.dispatch_order_rejected_messages()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'rejected' AND OLD.status IS DISTINCT FROM 'rejected'
     AND EXISTS (SELECT 1 FROM public.sms_templates WHERE scope = 'custom' AND enabled AND stage_key = 'rejected') THEN
    PERFORM net.http_post(
      url := 'https://gclbltatkbwbqxqqrcea.supabase.co/functions/v1/dispatch-order-messages',
      headers := jsonb_build_object('Content-Type','application/json','apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjbGJsdGF0a2J3YnF4cXFyY2VhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxNjI3MTIsImV4cCI6MjA3NDczODcxMn0.XMlZkzDNSdGtUINYlIqInoAbSyK4pGgZGZT--KOzNYM'),
      body := jsonb_build_object('orderId', NEW.id, 'stage', 'rejected', 'source', 'db')
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dispatch_order_rejected_messages ON public.projects_v3;
CREATE TRIGGER trg_dispatch_order_rejected_messages
AFTER UPDATE OF status ON public.projects_v3
FOR EACH ROW WHEN (NOT NEW.billing_only)
EXECUTE FUNCTION public.dispatch_order_rejected_messages();