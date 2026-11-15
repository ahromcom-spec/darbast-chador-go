CREATE OR REPLACE FUNCTION public.dispatch_order_event_messages()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _prefix text;
  _new jsonb := to_jsonb(NEW);
  _old jsonb := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END;
BEGIN
  IF TG_TABLE_NAME = 'projects_v3' THEN
    IF COALESCE((_new->>'discount_amount')::numeric, 0) <= 0
       OR COALESCE((_new->>'discount_amount')::numeric, 0) = COALESCE((_old->>'discount_amount')::numeric, 0) THEN
      RETURN NEW;
    END IF;
    _prefix := 'discount_';
  ELSE
    IF TG_OP = 'UPDATE' AND (_new->>'status') IS NOT DISTINCT FROM (_old->>'status') THEN
      RETURN NEW;
    END IF;
    _prefix := CASE TG_TABLE_NAME
      WHEN 'order_renewals' THEN 'renewal_'
      WHEN 'repair_requests' THEN 'repair_'
      WHEN 'order_transfer_requests' THEN 'transfer_'
      WHEN 'order_collaborators' THEN 'collaborator_'
    END;
  END IF;

  IF _prefix IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.sms_templates
    WHERE scope = 'custom' AND enabled AND stage_key LIKE _prefix || '%'
  ) THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := 'https://gclbltatkbwbqxqqrcea.supabase.co/functions/v1/dispatch-order-messages',
    headers := jsonb_build_object('Content-Type','application/json','apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjbGJsdGF0a2J3YnF4cXFyY2VhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxNjI3MTIsImV4cCI6MjA3NDczODcxMn0.XMlZkzDNSdGtUINYlIqInoAbSyK4pGgZGZT--KOzNYM'),
    body := jsonb_build_object(
      'source', 'db',
      'event', jsonb_build_object(
        'table', TG_TABLE_NAME,
        'id', NEW.id,
        'op', TG_OP,
        'oldStatus', _old->>'status',
        'newStatus', _new->>'status'
      )
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dispatch_renewal_messages ON public.order_renewals;
CREATE TRIGGER trg_dispatch_renewal_messages
AFTER INSERT OR UPDATE OF status ON public.order_renewals
FOR EACH ROW EXECUTE FUNCTION public.dispatch_order_event_messages();

DROP TRIGGER IF EXISTS trg_dispatch_repair_messages ON public.repair_requests;
CREATE TRIGGER trg_dispatch_repair_messages
AFTER INSERT OR UPDATE OF status ON public.repair_requests
FOR EACH ROW EXECUTE FUNCTION public.dispatch_order_event_messages();

DROP TRIGGER IF EXISTS trg_dispatch_transfer_messages ON public.order_transfer_requests;
CREATE TRIGGER trg_dispatch_transfer_messages
AFTER INSERT OR UPDATE OF status ON public.order_transfer_requests
FOR EACH ROW EXECUTE FUNCTION public.dispatch_order_event_messages();

DROP TRIGGER IF EXISTS trg_dispatch_collaborator_messages ON public.order_collaborators;
CREATE TRIGGER trg_dispatch_collaborator_messages
AFTER INSERT OR UPDATE OF status ON public.order_collaborators
FOR EACH ROW EXECUTE FUNCTION public.dispatch_order_event_messages();

DROP TRIGGER IF EXISTS trg_dispatch_discount_messages ON public.projects_v3;
CREATE TRIGGER trg_dispatch_discount_messages
AFTER UPDATE OF discount_amount ON public.projects_v3
FOR EACH ROW WHEN (NOT NEW.billing_only)
EXECUTE FUNCTION public.dispatch_order_event_messages();