
-- Shared recomputation: total_price = base(payment_amount or fallback) + approved renewals + effective repairs
CREATE OR REPLACE FUNCTION public.recompute_projects_v3_total_price(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment numeric := 0;
  v_current_total numeric := 0;
  v_renewals numeric := 0;
  v_repairs numeric := 0;
  v_base numeric := 0;
  v_new_total numeric := 0;
BEGIN
  IF _order_id IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(payment_amount, 0), COALESCE(total_price, 0)
    INTO v_payment, v_current_total
  FROM public.projects_v3
  WHERE id = _order_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(COALESCE(renewal_price, 0)), 0) INTO v_renewals
  FROM public.order_renewals
  WHERE order_id = _order_id AND status = 'approved';

  SELECT COALESCE(SUM(COALESCE(final_cost, estimated_cost, 0)), 0) INTO v_repairs
  FROM public.repair_requests
  WHERE order_id = _order_id
    AND status IN ('approved','completed','paid');

  -- base = payment_amount when known; otherwise assume current total already contained old renewals+repairs and back it out
  IF v_payment > 0 THEN
    v_base := v_payment;
  ELSE
    v_base := GREATEST(v_current_total - v_renewals - v_repairs, 0);
  END IF;

  v_new_total := v_base + v_renewals + v_repairs;

  UPDATE public.projects_v3
  SET total_price = v_new_total,
      updated_at = now()
  WHERE id = _order_id
    AND COALESCE(total_price, -1) <> v_new_total;
END;
$$;

-- Trigger for repair_requests
CREATE OR REPLACE FUNCTION public.trg_repair_recompute_total()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_projects_v3_total_price(OLD.order_id);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' AND OLD.order_id IS DISTINCT FROM NEW.order_id THEN
    PERFORM public.recompute_projects_v3_total_price(OLD.order_id);
    PERFORM public.recompute_projects_v3_total_price(NEW.order_id);
    RETURN NEW;
  ELSE
    PERFORM public.recompute_projects_v3_total_price(NEW.order_id);
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_repair_requests_recompute_total ON public.repair_requests;
CREATE TRIGGER trg_repair_requests_recompute_total
AFTER INSERT OR UPDATE OR DELETE ON public.repair_requests
FOR EACH ROW EXECUTE FUNCTION public.trg_repair_recompute_total();

-- Trigger for order_renewals (keep totals consistent with the same formula)
CREATE OR REPLACE FUNCTION public.trg_renewal_recompute_total()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_projects_v3_total_price(OLD.order_id);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' AND OLD.order_id IS DISTINCT FROM NEW.order_id THEN
    PERFORM public.recompute_projects_v3_total_price(OLD.order_id);
    PERFORM public.recompute_projects_v3_total_price(NEW.order_id);
    RETURN NEW;
  ELSE
    PERFORM public.recompute_projects_v3_total_price(NEW.order_id);
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_renewals_recompute_total ON public.order_renewals;
CREATE TRIGGER trg_order_renewals_recompute_total
AFTER INSERT OR UPDATE OR DELETE ON public.order_renewals
FOR EACH ROW EXECUTE FUNCTION public.trg_renewal_recompute_total();

-- Backfill: recompute for any order that has repairs or renewals today
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT DISTINCT order_id FROM public.repair_requests WHERE order_id IS NOT NULL
    UNION
    SELECT DISTINCT order_id FROM public.order_renewals WHERE order_id IS NOT NULL
  LOOP
    PERFORM public.recompute_projects_v3_total_price(r.order_id);
  END LOOP;
END $$;
