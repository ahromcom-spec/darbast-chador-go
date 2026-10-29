ALTER TABLE public.projects_v3 ADD COLUMN IF NOT EXISTS rental_end_date timestamptz;
COMMENT ON COLUMN public.projects_v3.billing_only IS 'Charge-separated independent order with full UI and collection; zero base price and no duplicate initial installation automation';
CREATE OR REPLACE FUNCTION public.prepare_separated_order() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n jsonb; mother public.projects_v3%ROWTYPE;
BEGIN
 IF NOT NEW.billing_only THEN RETURN NEW; END IF;
 BEGIN n:=coalesce(NEW.notes::jsonb,'{}'); EXCEPTION WHEN others THEN n:='{}'; END;
 IF jsonb_typeof(n)<>'object' THEN n:='{}'; END IF;
 SELECT * INTO mother FROM public.projects_v3 WHERE id=coalesce(nullif(n->>'billing_source_order_id','')::uuid,NEW.original_order_id);
 IF FOUND THEN
 NEW.contractor_id:=mother.contractor_id; NEW.executed_by:=mother.executed_by; NEW.approved_by:=mother.approved_by; NEW.approved_at:=mother.approved_at;
 NEW.execution_start_date:=mother.execution_start_date; NEW.execution_end_date:=mother.execution_end_date; NEW.execution_confirmed_at:=mother.execution_confirmed_at;
 NEW.location_confirmed_by_customer:=mother.location_confirmed_by_customer; NEW.location_confirmed_at:=mother.location_confirmed_at;
 END IF;
 n:=n - ARRAY['estimated_price','estimatedPrice','total_price','manager_set_price','price_breakdown','multi_summary','unit_price','custom_unit_price','rental_end_date','dueDate','dueDateTime','due_date'];
 n:=n || jsonb_build_object('billing_only',true,'is_expert_pricing_request',false,'is_custom_service',false,'price_set_by_manager',false);
 NEW.notes:=n::text; NEW.is_renewal:=true; RETURN NEW;
END; $$;
CREATE TRIGGER prepare_separated_order BEFORE INSERT ON public.projects_v3 FOR EACH ROW WHEN (NEW.billing_only) EXECUTE FUNCTION public.prepare_separated_order();
CREATE OR REPLACE FUNCTION public.sync_separated_order_period(_order_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE first_date timestamptz; last_date timestamptz; n jsonb;
BEGIN
 SELECT min(new_start_date),max(new_end_date) INTO first_date,last_date FROM public.order_renewals WHERE coalesce(billing_order_id,order_id)=_order_id AND status='approved';
 SELECT notes::jsonb INTO n FROM public.projects_v3 WHERE id=_order_id AND billing_only;
 IF NOT FOUND THEN RETURN; END IF;
 UPDATE public.projects_v3 SET rental_start_date=coalesce(first_date,rental_start_date),rental_end_date=last_date,
 notes=(coalesce(n,'{}') || jsonb_build_object('rental_start_date',coalesce(first_date,rental_start_date),'rental_end_date',last_date))::text,updated_at=now() WHERE id=_order_id;
END; $$;
REVOKE ALL ON FUNCTION public.sync_separated_order_period(uuid) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.trg_sync_separated_order_period() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP<>'INSERT' THEN PERFORM public.sync_separated_order_period(coalesce(OLD.billing_order_id,OLD.order_id)); END IF;
 IF TG_OP<>'DELETE' THEN PERFORM public.sync_separated_order_period(coalesce(NEW.billing_order_id,NEW.order_id)); RETURN NEW; END IF; RETURN OLD;
END; $$;
CREATE TRIGGER sync_separated_renewal_period AFTER INSERT OR UPDATE OR DELETE ON public.order_renewals FOR EACH ROW EXECUTE FUNCTION public.trg_sync_separated_order_period();
WITH periods AS (SELECT coalesce(billing_order_id,order_id) id,min(new_start_date) first_date,max(new_end_date) last_date FROM public.order_renewals WHERE status='approved' GROUP BY 1)
UPDATE public.projects_v3 p SET rental_start_date=coalesce(r.first_date,p.rental_start_date),rental_end_date=r.last_date,
 notes=((p.notes::jsonb - ARRAY['estimated_price','estimatedPrice','total_price','manager_set_price','price_breakdown','multi_summary','unit_price','custom_unit_price','dueDate','dueDateTime','due_date']) || jsonb_build_object('billing_only',true,'is_expert_pricing_request',false,'is_custom_service',false,'price_set_by_manager',false,'rental_start_date',coalesce(r.first_date,p.rental_start_date),'rental_end_date',r.last_date))::text,is_renewal=true FROM periods r WHERE p.id=r.id AND p.billing_only;