CREATE OR REPLACE FUNCTION public.recompute_projects_v3_total_price(_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_payment numeric := 0;
  v_current_total numeric := 0;
  v_renewals numeric := 0;
  v_repairs numeric := 0;
  v_base numeric := 0;
  v_new_total numeric := 0;
  v_parts_count integer := 0;
  v_parts_sum numeric := 0;
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

  -- هزینه تعمیر از لحظه تایید مدیر (و همه مراحل بعدی) به مبلغ کل سفارش اضافه می‌شود
  SELECT COALESCE(SUM(COALESCE(final_cost, estimated_cost, 0)), 0) INTO v_repairs
  FROM public.repair_requests
  WHERE order_id = _order_id
    AND status IN ('approved','awaiting_repair','repaired','completed','paid');

  SELECT COUNT(*), COALESCE(SUM(COALESCE(price, 0)), 0)
    INTO v_parts_count, v_parts_sum
  FROM public.order_parts
  WHERE order_id = _order_id AND status <> 'cancelled';

  IF v_parts_count > 0 THEN
    v_base := v_parts_sum;
    UPDATE public.projects_v3
    SET payment_amount = v_parts_sum
    WHERE id = _order_id AND COALESCE(payment_amount, -1) <> v_parts_sum;
  ELSIF v_payment > 0 THEN
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
$function$;