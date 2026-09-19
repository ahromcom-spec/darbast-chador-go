CREATE TABLE public.order_parts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.projects_v3(id) ON DELETE CASCADE,
  part_number integer NOT NULL,
  title text,
  description text,
  dimensions jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_area numeric,
  price numeric NOT NULL DEFAULT 0,
  rental_start_date timestamptz,
  rental_end_date timestamptz,
  status text NOT NULL DEFAULT 'active',
  collection_requested_at timestamptz,
  collected_at timestamptz,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT order_parts_status_check CHECK (status IN ('active','awaiting_collection','in_collection','collected','cancelled')),
  CONSTRAINT order_parts_unique_number UNIQUE (order_id, part_number)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_parts TO authenticated;
GRANT ALL ON public.order_parts TO service_role;

ALTER TABLE public.order_parts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can manage order parts"
ON public.order_parts FOR ALL TO authenticated
USING (public.can_manage_order_renewals(auth.uid()))
WITH CHECK (public.can_manage_order_renewals(auth.uid()));

CREATE POLICY "Customers can view their order parts"
ON public.order_parts FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.projects_v3 p
  JOIN public.customers c ON c.id = p.customer_id
  WHERE p.id = order_parts.order_id AND c.user_id = auth.uid()
));

CREATE INDEX idx_order_parts_order_id ON public.order_parts(order_id);

CREATE TRIGGER update_order_parts_updated_at
BEFORE UPDATE ON public.order_parts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.order_renewals ADD COLUMN part_id uuid REFERENCES public.order_parts(id) ON DELETE CASCADE;
ALTER TABLE public.collection_requests ADD COLUMN part_id uuid REFERENCES public.order_parts(id) ON DELETE CASCADE;
CREATE INDEX idx_order_renewals_part_id ON public.order_renewals(part_id);
CREATE INDEX idx_collection_requests_part_id ON public.collection_requests(part_id);

ALTER TABLE public.order_renewals DROP CONSTRAINT IF EXISTS unique_renewal_per_order;
CREATE UNIQUE INDEX unique_renewal_per_order_part
  ON public.order_renewals(order_id, COALESCE(part_id, '00000000-0000-0000-0000-000000000000'::uuid), renewal_number);

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

  SELECT COALESCE(SUM(COALESCE(final_cost, estimated_cost, 0)), 0) INTO v_repairs
  FROM public.repair_requests
  WHERE order_id = _order_id
    AND status IN ('approved','completed','paid');

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

CREATE OR REPLACE FUNCTION public.trg_order_parts_recompute_total()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.recompute_projects_v3_total_price(COALESCE(NEW.order_id, OLD.order_id));
  RETURN NULL;
END;
$$;

CREATE TRIGGER order_parts_recompute_total
AFTER INSERT OR UPDATE OR DELETE ON public.order_parts
FOR EACH ROW EXECUTE FUNCTION public.trg_order_parts_recompute_total();