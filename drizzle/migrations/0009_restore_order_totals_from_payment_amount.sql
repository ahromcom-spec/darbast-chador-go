CREATE OR REPLACE FUNCTION public.default_order_total_from_payment_amount()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE r numeric; x numeric;
BEGIN
  IF COALESCE(NEW.billing_only, false)
     OR COALESCE(NEW.total_price, 0) <> 0
     OR COALESCE(NEW.payment_amount, 0) <= 0
     OR COALESCE(NEW.discount_amount, 0) > 0 THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND EXISTS (SELECT 1 FROM public.order_parts WHERE order_id = NEW.id AND status <> 'cancelled') THEN
    RETURN NEW;
  END IF;
  SELECT COALESCE(sum(renewal_price), 0) INTO r FROM public.order_renewals
    WHERE COALESCE(billing_order_id, order_id) = NEW.id AND status = 'approved';
  SELECT COALESCE(sum(COALESCE(final_cost, estimated_cost, 0)), 0) INTO x FROM public.repair_requests
    WHERE COALESCE(billing_order_id, order_id) = NEW.id AND status IN ('approved','awaiting_repair','repaired','completed','paid');
  NEW.total_price := NEW.payment_amount + r + x;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS default_order_total_from_payment_amount ON public.projects_v3;
CREATE TRIGGER default_order_total_from_payment_amount
BEFORE INSERT OR UPDATE OF total_price, payment_amount, discount_amount, billing_only ON public.projects_v3
FOR EACH ROW EXECUTE FUNCTION public.default_order_total_from_payment_amount();

-- Backfill orders whose cost was stored only in payment_amount (total_price left at default 0),
-- without firing wallet/notification side effects.
ALTER TABLE public.projects_v3 DISABLE TRIGGER USER;

UPDATE public.projects_v3 o
SET total_price = o.payment_amount
  + COALESCE((SELECT sum(renewal_price) FROM public.order_renewals r
              WHERE COALESCE(r.billing_order_id, r.order_id) = o.id AND r.status = 'approved'), 0)
  + COALESCE((SELECT sum(COALESCE(final_cost, estimated_cost, 0)) FROM public.repair_requests q
              WHERE COALESCE(q.billing_order_id, q.order_id) = o.id
                AND q.status IN ('approved','awaiting_repair','repaired','completed','paid')), 0)
WHERE COALESCE(o.total_price, 0) = 0
  AND COALESCE(o.payment_amount, 0) > 0
  AND NOT COALESCE(o.billing_only, false)
  AND COALESCE(o.discount_amount, 0) = 0
  AND NOT EXISTS (SELECT 1 FROM public.order_parts p WHERE p.order_id = o.id AND p.status <> 'cancelled');

ALTER TABLE public.projects_v3 ENABLE TRIGGER USER;