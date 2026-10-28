ALTER TABLE public.projects_v3 ADD COLUMN IF NOT EXISTS billing_only boolean NOT NULL DEFAULT false, ADD COLUMN IF NOT EXISTS billing_base_amount numeric;
ALTER TABLE public.order_renewals ADD COLUMN IF NOT EXISTS billing_order_id uuid REFERENCES public.projects_v3(id);
ALTER TABLE public.repair_requests ADD COLUMN IF NOT EXISTS billing_order_id uuid REFERENCES public.projects_v3(id);
CREATE INDEX IF NOT EXISTS renewal_billing_order_idx ON public.order_renewals(billing_order_id);
CREATE INDEX IF NOT EXISTS repair_billing_order_idx ON public.repair_requests(billing_order_id);
CREATE TABLE public.order_charge_transfers (id uuid PRIMARY KEY, source_order_id uuid NOT NULL REFERENCES public.projects_v3(id), target_order_id uuid NOT NULL REFERENCES public.projects_v3(id), renewal_ids uuid[] NOT NULL DEFAULT '{}', repair_ids uuid[] NOT NULL DEFAULT '{}', amount numeric NOT NULL, actor_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.order_charge_transfers TO authenticated;
GRANT ALL ON public.order_charge_transfers TO service_role;
ALTER TABLE public.order_charge_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own charge transfers or managers" ON public.order_charge_transfers FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.projects_v3 p JOIN public.customers c ON c.id=p.customer_id WHERE p.id=source_order_id AND c.user_id=auth.uid()) OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'ceo') OR public.has_role(auth.uid(),'general_manager') OR public.has_role(auth.uid(),'finance_manager') OR public.has_role(auth.uid(),'scaffold_executive_manager') OR public.has_role(auth.uid(),'executive_manager_scaffold_execution_with_materials') OR public.has_role(auth.uid(),'rental_executive_manager'));
CREATE OR REPLACE FUNCTION public.recompute_projects_v3_total_price(_order_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.projects_v3%ROWTYPE; r numeric; x numeric; old_r numeric; old_x numeric; base numeric; part_sum numeric; part_count integer; amount numeric;
BEGIN
 SELECT * INTO p FROM public.projects_v3 WHERE id=_order_id FOR UPDATE; IF NOT FOUND THEN RETURN; END IF;
 SELECT coalesce(sum(renewal_price),0) INTO r FROM public.order_renewals WHERE coalesce(billing_order_id,order_id)=_order_id AND status='approved';
 SELECT coalesce(sum(coalesce(final_cost,estimated_cost,0)),0) INTO x FROM public.repair_requests WHERE coalesce(billing_order_id,order_id)=_order_id AND status IN ('approved','awaiting_repair','repaired','completed','paid');
 SELECT count(*),coalesce(sum(price),0) INTO part_count,part_sum FROM public.order_parts WHERE order_id=_order_id AND status<>'cancelled';
 IF p.billing_only THEN base:=0;
 ELSIF part_count>0 THEN base:=part_sum;
 ELSIF p.billing_base_amount IS NOT NULL THEN base:=coalesce(p.payment_amount,p.billing_base_amount);
 ELSIF coalesce(p.payment_amount,0)>0 THEN base:=p.payment_amount;
 ELSE
 SELECT coalesce(sum(renewal_price),0) INTO old_r FROM public.order_renewals WHERE order_id=_order_id AND status='approved';
 SELECT coalesce(sum(coalesce(final_cost,estimated_cost,0)),0) INTO old_x FROM public.repair_requests WHERE order_id=_order_id AND status IN ('approved','awaiting_repair','repaired','completed','paid');
 base:=greatest(coalesce(p.total_price,0)-old_r-old_x,0);
 END IF;
 amount:=greatest(base+r+x-coalesce(p.discount_amount,0),0);
 UPDATE public.projects_v3 SET total_price=amount, payment_amount=CASE WHEN billing_only THEN 0 WHEN part_count>0 THEN part_sum ELSE payment_amount END, payment_confirmed_at=CASE WHEN coalesce(total_paid,0)<amount THEN NULL ELSE payment_confirmed_at END, payment_confirmed_by=CASE WHEN coalesce(total_paid,0)<amount THEN NULL ELSE payment_confirmed_by END, updated_at=now() WHERE id=_order_id AND (total_price IS DISTINCT FROM amount OR (coalesce(total_paid,0)<amount AND payment_confirmed_at IS NOT NULL));
END; $$;
CREATE OR REPLACE FUNCTION public.trg_renewal_recompute_total() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP<>'INSERT' THEN PERFORM public.recompute_projects_v3_total_price(coalesce(OLD.billing_order_id,OLD.order_id)); END IF;
 IF TG_OP<>'DELETE' THEN PERFORM public.recompute_projects_v3_total_price(coalesce(NEW.billing_order_id,NEW.order_id)); RETURN NEW; END IF; RETURN OLD;
END; $$;
CREATE OR REPLACE FUNCTION public.trg_repair_recompute_total() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP<>'INSERT' THEN PERFORM public.recompute_projects_v3_total_price(coalesce(OLD.billing_order_id,OLD.order_id)); END IF;
 IF TG_OP<>'DELETE' THEN PERFORM public.recompute_projects_v3_total_price(coalesce(NEW.billing_order_id,NEW.order_id)); RETURN NEW; END IF; RETURN OLD;
END; $$;
DO $$ DECLARE t record; def text; BEGIN
 FOR t IN SELECT tgname,pg_get_triggerdef(oid) d FROM pg_trigger WHERE tgrelid='public.projects_v3'::regclass AND NOT tgisinternal AND tgname IN ('create_approvals_on_order_submit','create_order_approvals_trigger','handle_approval_on_order','handle_order_workflow','notify_on_new_order','notify_on_order_update','on_order_status_change','order_approval_workflow_trigger','order_workflow_trigger','trg_auto_dispatch_v3','trg_handle_order_approval','trg_notify_site_new_order','trg_notify_site_order_stage_change','trigger_notify_managers_on_new_order','trigger_notify_order_status_change','trigger_order_automation_on_insert','sync_location_active_on_orders','sync_project_v3_location_to_hierarchy_trigger') LOOP
 def:=t.d;
 IF def LIKE '% WHEN (%' THEN def:=replace(def,' WHEN (',' WHEN (NOT NEW.billing_only AND '); ELSE def:=replace(def,' EXECUTE FUNCTION',' WHEN (NOT NEW.billing_only) EXECUTE FUNCTION'); END IF;
 IF def LIKE '% DELETE %' THEN CONTINUE; END IF;
 EXECUTE format('DROP TRIGGER %I ON public.projects_v3',t.tgname); EXECUTE def;
 END LOOP;
END; $$;
CREATE OR REPLACE FUNCTION public.transfer_order_charges(_source_order_id uuid, _renewal_ids uuid[], _repair_ids uuid[], _request_id uuid, _target_order_id uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE src public.projects_v3%ROWTYPE; dest public.projects_v3%ROWTYPE; transfer public.order_charge_transfers%ROWTYPE; stmt uuid; stmt_number integer; price numeric:=0; n integer; notes_json jsonb; nr integer:=coalesce(cardinality(_renewal_ids),0); nx integer:=coalesce(cardinality(_repair_ids),0);
BEGIN
 IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'ceo') OR public.has_role(auth.uid(),'general_manager') OR public.has_role(auth.uid(),'finance_manager') OR public.has_role(auth.uid(),'scaffold_executive_manager') OR public.has_role(auth.uid(),'executive_manager_scaffold_execution_with_materials') OR public.has_role(auth.uid(),'rental_executive_manager')) THEN RAISE EXCEPTION 'جداسازی فقط توسط مدیریت مجاز است'; END IF;
 IF _request_id IS NULL OR nr+nx=0 OR nr+nx>100 THEN RAISE EXCEPTION 'تمدید یا تعمیر را انتخاب کنید'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(_request_id::text,0));
 SELECT * INTO transfer FROM public.order_charge_transfers WHERE id=_request_id;
 IF FOUND THEN IF transfer.source_order_id<>_source_order_id OR transfer.actor_id<>auth.uid() THEN RAISE EXCEPTION 'درخواست نامعتبر'; END IF; RETURN jsonb_build_object('order_id',transfer.target_order_id,'amount',transfer.amount); END IF;
 SELECT * INTO src FROM public.projects_v3 WHERE id=_source_order_id FOR UPDATE;
 IF NOT FOUND OR src.customer_id IS NULL THEN RAISE EXCEPTION 'سفارش مبدأ یافت نشد'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(src.customer_id::text,1));
 PERFORM 1 FROM public.order_renewals WHERE id=ANY(coalesce(_renewal_ids,'{}')) ORDER BY id FOR UPDATE;
 PERFORM 1 FROM public.repair_requests WHERE id=ANY(coalesce(_repair_ids,'{}')) ORDER BY id FOR UPDATE;
 SELECT count(*),coalesce(sum(renewal_price),0) INTO n,price FROM public.order_renewals WHERE id=ANY(coalesce(_renewal_ids,'{}')) AND coalesce(billing_order_id,order_id)=src.id AND status='approved' AND renewal_price>=0;
 IF n<>nr THEN RAISE EXCEPTION 'تمدید انتخابی تغییر کرده یا در این سفارش نیست'; END IF;
 SELECT count(*),price+coalesce(sum(coalesce(final_cost,estimated_cost,0)),0) INTO n,price FROM public.repair_requests WHERE id=ANY(coalesce(_repair_ids,'{}')) AND coalesce(billing_order_id,order_id)=src.id AND status IN ('approved','awaiting_repair','repaired','completed','paid') AND coalesce(final_cost,estimated_cost,0)>=0;
 IF n<>nx THEN RAISE EXCEPTION 'تعمیر انتخابی تغییر کرده یا در این سفارش نیست'; END IF;
 IF src.billing_base_amount IS NULL THEN
 UPDATE public.projects_v3 SET billing_base_amount=CASE WHEN billing_only THEN 0 ELSE greatest(coalesce(payment_amount,total_price-price,0),0) END, payment_amount=CASE WHEN billing_only THEN 0 ELSE coalesce(payment_amount,greatest(coalesce(total_price,0)-(SELECT coalesce(sum(renewal_price),0) FROM public.order_renewals WHERE coalesce(billing_order_id,order_id)=src.id AND status='approved')-(SELECT coalesce(sum(coalesce(final_cost,estimated_cost,0)),0) FROM public.repair_requests WHERE coalesce(billing_order_id,order_id)=src.id AND status IN ('approved','awaiting_repair','repaired','completed','paid')),0)) END WHERE id=src.id;
 END IF;
 IF _target_order_id IS NULL THEN
 SELECT coalesce(max(statement_number),0)+1 INTO stmt_number FROM public.customer_statements WHERE customer_id=src.customer_id;
 INSERT INTO public.customer_statements(customer_id,statement_number,is_manual,subcategory_id,address,detailed_address) VALUES(src.customer_id,stmt_number,true,src.subcategory_id,src.address,src.detailed_address) RETURNING id INTO stmt;
 BEGIN notes_json:=coalesce(src.notes::jsonb,'{}'); EXCEPTION WHEN others THEN notes_json:=jsonb_build_object('description',src.notes); END;
 IF jsonb_typeof(notes_json)<>'object' THEN notes_json:=jsonb_build_object('description',src.notes); END IF;
 notes_json:=notes_json || jsonb_build_object('billing_only',true,'billing_source_code',src.code,'billing_source_order_id',src.id);
 INSERT INTO public.projects_v3(code,customer_id,province_id,district_id,subcategory_id,hierarchy_project_id,address,detailed_address,notes,status,execution_stage,rental_start_date,customer_name,customer_phone,location_lat,location_lng,original_order_id,billing_only,billing_base_amount,payment_amount,total_price,total_paid,statement_id)
 VALUES(lpad(nextval('public.project_code_seq')::text,7,'0'),src.customer_id,src.province_id,src.district_id,src.subcategory_id,src.hierarchy_project_id,src.address,src.detailed_address,notes_json::text,'completed','awaiting_payment',src.rental_start_date,src.customer_name,src.customer_phone,src.location_lat,src.location_lng,coalesce(src.original_order_id,src.id),true,0,0,0,0,stmt) RETURNING * INTO dest;
 ELSE
 SELECT * INTO dest FROM public.projects_v3 WHERE id=_target_order_id FOR UPDATE;
 IF NOT FOUND OR dest.customer_id<>src.customer_id OR dest.id=src.id OR dest.status IN ('draft','rejected') OR dest.is_deep_archived THEN RAISE EXCEPTION 'سفارش مقصد باید متعلق به همین مشتری و متفاوت باشد'; END IF;
 IF dest.billing_base_amount IS NULL THEN UPDATE public.projects_v3 SET billing_base_amount=coalesce(payment_amount,0) WHERE id=dest.id; END IF;
 END IF;
 UPDATE public.order_renewals SET billing_order_id=dest.id WHERE id=ANY(coalesce(_renewal_ids,'{}'));
 UPDATE public.repair_requests SET billing_order_id=dest.id WHERE id=ANY(coalesce(_repair_ids,'{}'));
 PERFORM public.recompute_projects_v3_total_price(src.id); PERFORM public.recompute_projects_v3_total_price(dest.id);
 INSERT INTO public.order_charge_transfers(id,source_order_id,target_order_id,renewal_ids,repair_ids,amount,actor_id) VALUES(_request_id,src.id,dest.id,coalesce(_renewal_ids,'{}'),coalesce(_repair_ids,'{}'),price,auth.uid());
 RETURN jsonb_build_object('order_id',dest.id,'code',dest.code,'statement_id',dest.statement_id,'amount',price);
END; $$;
REVOKE ALL ON FUNCTION public.transfer_order_charges(uuid,uuid[],uuid[],uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.transfer_order_charges(uuid,uuid[],uuid[],uuid,uuid) TO authenticated;
COMMENT ON COLUMN public.order_renewals.billing_order_id IS 'Financial destination only; operational order_id and part_id remain unchanged';
COMMENT ON COLUMN public.projects_v3.billing_only IS 'Independent renewal/repair invoice, not a new physical execution';