CREATE OR REPLACE FUNCTION public.guard_charge_billing_assignment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF (TG_OP='INSERT' AND NEW.billing_order_id IS NOT NULL) OR (TG_OP='UPDATE' AND NEW.billing_order_id IS DISTINCT FROM OLD.billing_order_id) THEN
 IF coalesce(current_setting('app.charge_transfer',true),'')<>'true' OR auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'ceo') OR public.has_role(auth.uid(),'general_manager') OR public.has_role(auth.uid(),'finance_manager') OR public.has_role(auth.uid(),'scaffold_executive_manager') OR public.has_role(auth.uid(),'executive_manager_scaffold_execution_with_materials') OR public.has_role(auth.uid(),'rental_executive_manager')) THEN RAISE EXCEPTION 'انتقال هزینه فقط از ابزار جداسازی مدیریت امکان‌پذیر است'; END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER guard_renewal_billing BEFORE INSERT OR UPDATE ON public.order_renewals FOR EACH ROW EXECUTE FUNCTION public.guard_charge_billing_assignment();
CREATE TRIGGER guard_repair_billing BEFORE INSERT OR UPDATE ON public.repair_requests FOR EACH ROW EXECUTE FUNCTION public.guard_charge_billing_assignment();
CREATE OR REPLACE FUNCTION public.transfer_order_charges(_source_order_id uuid, _renewal_ids uuid[], _repair_ids uuid[], _request_id uuid, _target_order_id uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE src public.projects_v3%ROWTYPE; dest public.projects_v3%ROWTYPE; transfer public.order_charge_transfers%ROWTYPE; stmt uuid; stmt_number integer; price numeric:=0; n integer; notes_json jsonb; nr integer:=coalesce(cardinality(_renewal_ids),0); nx integer:=coalesce(cardinality(_repair_ids),0); base numeric; extras numeric;
BEGIN
 IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'ceo') OR public.has_role(auth.uid(),'general_manager') OR public.has_role(auth.uid(),'finance_manager') OR public.has_role(auth.uid(),'scaffold_executive_manager') OR public.has_role(auth.uid(),'executive_manager_scaffold_execution_with_materials') OR public.has_role(auth.uid(),'rental_executive_manager')) THEN RAISE EXCEPTION 'جداسازی فقط توسط مدیریت مجاز است'; END IF;
 IF _request_id IS NULL OR nr+nx=0 OR nr+nx>100 THEN RAISE EXCEPTION 'تمدید یا تعمیر را انتخاب کنید'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(_request_id::text,0));
 SELECT * INTO transfer FROM public.order_charge_transfers WHERE id=_request_id;
 IF FOUND THEN IF transfer.source_order_id<>_source_order_id OR transfer.actor_id<>auth.uid() THEN RAISE EXCEPTION 'درخواست نامعتبر'; END IF; RETURN jsonb_build_object('order_id',transfer.target_order_id,'amount',transfer.amount); END IF;
 SELECT * INTO src FROM public.projects_v3 WHERE id=_source_order_id;
 IF NOT FOUND OR src.customer_id IS NULL THEN RAISE EXCEPTION 'سفارش مبدأ یافت نشد'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(src.customer_id::text,1));
 SELECT * INTO src FROM public.projects_v3 WHERE id=_source_order_id FOR UPDATE;
 PERFORM 1 FROM public.order_renewals WHERE id=ANY(coalesce(_renewal_ids,'{}')) ORDER BY id FOR UPDATE;
 PERFORM 1 FROM public.repair_requests WHERE id=ANY(coalesce(_repair_ids,'{}')) ORDER BY id FOR UPDATE;
 SELECT count(*),coalesce(sum(renewal_price),0) INTO n,price FROM public.order_renewals WHERE id=ANY(coalesce(_renewal_ids,'{}')) AND coalesce(billing_order_id,order_id)=src.id AND status='approved' AND renewal_price>=0;
 IF n<>nr THEN RAISE EXCEPTION 'تمدید انتخابی تغییر کرده یا در این سفارش نیست'; END IF;
 SELECT count(*),price+coalesce(sum(coalesce(final_cost,estimated_cost,0)),0) INTO n,price FROM public.repair_requests WHERE id=ANY(coalesce(_repair_ids,'{}')) AND coalesce(billing_order_id,order_id)=src.id AND status IN ('approved','awaiting_repair','repaired','completed','paid') AND coalesce(final_cost,estimated_cost,0)>=0;
 IF n<>nx THEN RAISE EXCEPTION 'تعمیر انتخابی تغییر کرده یا در این سفارش نیست'; END IF;
 IF src.billing_base_amount IS NULL THEN
 SELECT (SELECT coalesce(sum(renewal_price),0) FROM public.order_renewals WHERE coalesce(billing_order_id,order_id)=src.id AND status='approved')+(SELECT coalesce(sum(coalesce(final_cost,estimated_cost,0)),0) FROM public.repair_requests WHERE coalesce(billing_order_id,order_id)=src.id AND status IN ('approved','awaiting_repair','repaired','completed','paid')) INTO extras;
 base:=CASE WHEN src.billing_only THEN 0 ELSE coalesce(src.payment_amount,greatest(coalesce(src.total_price,0)-extras+coalesce(src.discount_amount,0),0)) END;
 UPDATE public.projects_v3 SET billing_base_amount=base,payment_amount=base WHERE id=src.id;
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
 IF dest.billing_base_amount IS NULL THEN
 SELECT (SELECT coalesce(sum(renewal_price),0) FROM public.order_renewals WHERE coalesce(billing_order_id,order_id)=dest.id AND status='approved')+(SELECT coalesce(sum(coalesce(final_cost,estimated_cost,0)),0) FROM public.repair_requests WHERE coalesce(billing_order_id,order_id)=dest.id AND status IN ('approved','awaiting_repair','repaired','completed','paid')) INTO extras;
 base:=CASE WHEN dest.billing_only THEN 0 ELSE coalesce(dest.payment_amount,greatest(coalesce(dest.total_price,0)-extras+coalesce(dest.discount_amount,0),0)) END;
 UPDATE public.projects_v3 SET billing_base_amount=base,payment_amount=base WHERE id=dest.id;
 END IF;
 END IF;
 PERFORM set_config('app.charge_transfer','true',true);
 UPDATE public.order_renewals SET billing_order_id=dest.id WHERE id=ANY(coalesce(_renewal_ids,'{}'));
 UPDATE public.repair_requests SET billing_order_id=dest.id WHERE id=ANY(coalesce(_repair_ids,'{}'));
 PERFORM public.recompute_projects_v3_total_price(src.id); PERFORM public.recompute_projects_v3_total_price(dest.id);
 INSERT INTO public.order_charge_transfers(id,source_order_id,target_order_id,renewal_ids,repair_ids,amount,actor_id) VALUES(_request_id,src.id,dest.id,coalesce(_renewal_ids,'{}'),coalesce(_repair_ids,'{}'),price,auth.uid());
 RETURN jsonb_build_object('order_id',dest.id,'code',dest.code,'statement_id',dest.statement_id,'amount',price);
END; $$;