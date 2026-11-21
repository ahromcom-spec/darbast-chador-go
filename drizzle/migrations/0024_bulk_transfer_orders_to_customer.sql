CREATE OR REPLACE FUNCTION public.manager_transfer_orders_to_customer(p_order_ids uuid[], p_phone text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order RECORD;
  v_src_hier RECORD;
  v_target_user_id uuid;
  v_target_name text;
  v_target_phone text;
  v_customer_id uuid;
  v_old_owner uuid;
  v_loc_key text;
  v_hier_key text;
  v_location_id uuid;
  v_hierarchy_id uuid;
  v_service_type_id uuid;
  v_new_statement_id uuid;
  v_loc_map jsonb := '{}'::jsonb;
  v_hier_map jsonb := '{}'::jsonb;
  v_statements uuid[] := '{}';
  v_old_owners uuid[] := '{}';
  v_codes text[] := '{}';
  v_moved int := 0;
  v_skipped int := 0;
  v_sid uuid;
  v_uid uuid;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.has_role(auth.uid(), 'ceo'::app_role) OR
    public.has_role(auth.uid(), 'general_manager'::app_role) OR
    public.has_role(auth.uid(), 'finance_manager'::app_role) OR
    public.has_role(auth.uid(), 'sales_manager'::app_role) OR
    public.has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR
    public.has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role) OR
    public.has_role(auth.uid(), 'rental_executive_manager'::app_role)
  ) THEN
    RAISE EXCEPTION 'دسترسی غیرمجاز برای انتقال سفارش';
  END IF;

  IF p_order_ids IS NULL OR coalesce(array_length(p_order_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'هیچ سفارشی برای انتقال انتخاب نشده است';
  END IF;
  IF array_length(p_order_ids, 1) > 300 THEN
    RAISE EXCEPTION 'حداکثر ۳۰۰ سفارش در هر انتقال مجاز است';
  END IF;

  SELECT user_id, full_name, phone_number
    INTO v_target_user_id, v_target_name, v_target_phone
  FROM public.profiles WHERE phone_number = p_phone LIMIT 1;
  IF v_target_user_id IS NULL THEN
    RAISE EXCEPTION 'مشتری با این شماره تلفن ثبت‌نام نکرده است';
  END IF;

  SELECT id INTO v_customer_id FROM public.customers WHERE user_id = v_target_user_id;
  IF v_customer_id IS NULL THEN
    INSERT INTO public.customers (user_id) VALUES (v_target_user_id) RETURNING id INTO v_customer_id;
  END IF;

  FOR v_order IN
    SELECT * FROM public.projects_v3
    WHERE id = ANY(p_order_ids) AND coalesce(is_deep_archived, false) = false
    ORDER BY created_at
    FOR UPDATE
  LOOP
    SELECT user_id INTO v_old_owner FROM public.customers WHERE id = v_order.customer_id;
    IF v_old_owner IS NOT DISTINCT FROM v_target_user_id THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    SELECT * INTO v_src_hier FROM public.projects_hierarchy WHERE id = v_order.hierarchy_project_id;

    -- one destination address per source address
    v_loc_key := coalesce(v_src_hier.location_id::text, 'order:' || v_order.id::text);
    v_location_id := (v_loc_map ->> v_loc_key)::uuid;
    IF v_location_id IS NULL THEN
      INSERT INTO public.locations (user_id, address_line, title, lat, lng, province_id, district_id)
      SELECT v_target_user_id,
             coalesce(l.address_line, v_order.address, 'آدرس انتقالی'),
             coalesce(l.title, v_order.detailed_address, 'آدرس انتقالی'),
             coalesce(l.lat, v_order.location_lat, 34.6401),
             coalesce(l.lng, v_order.location_lng, 50.8764),
             coalesce(l.province_id, v_order.province_id),
             coalesce(l.district_id, v_order.district_id)
      FROM (SELECT 1) x
      LEFT JOIN public.locations l ON l.id = v_src_hier.location_id
      RETURNING id INTO v_location_id;
      v_loc_map := v_loc_map || jsonb_build_object(v_loc_key, v_location_id);
    END IF;

    -- one destination project per source project
    v_hier_key := coalesce(v_order.hierarchy_project_id::text, 'order:' || v_order.id::text);
    v_hierarchy_id := (v_hier_map ->> v_hier_key)::uuid;
    IF v_hierarchy_id IS NULL THEN
      SELECT service_type_id INTO v_service_type_id FROM public.subcategories WHERE id = v_order.subcategory_id;
      INSERT INTO public.projects_hierarchy (user_id, location_id, service_type_id, subcategory_id, title, status)
      VALUES (
        v_target_user_id, v_location_id,
        coalesce(v_src_hier.service_type_id, v_service_type_id),
        coalesce(v_src_hier.subcategory_id, v_order.subcategory_id),
        coalesce(nullif(v_src_hier.title, ''), 'پروژه انتقالی - ' || coalesce(v_order.code, '')),
        'active'
      ) RETURNING id INTO v_hierarchy_id;
      v_hier_map := v_hier_map || jsonb_build_object(v_hier_key, v_hierarchy_id);
    END IF;

    v_new_statement_id := public.get_or_create_open_statement(
      v_customer_id, v_order.subcategory_id, v_order.address, v_order.detailed_address
    );

    UPDATE public.projects_v3
    SET customer_id = v_customer_id,
        hierarchy_project_id = v_hierarchy_id,
        transferred_from_user_id = v_old_owner,
        transferred_from_phone = v_order.customer_phone,
        customer_name = coalesce(v_target_name, customer_name),
        customer_phone = coalesce(v_target_phone, p_phone),
        statement_id = v_new_statement_id,
        updated_at = now()
    WHERE id = v_order.id;

    UPDATE public.order_collaborators
    SET status = 'exited', updated_at = now()
    WHERE order_id = v_order.id
      AND status NOT IN ('exited', 'rejected', 'manager_rejected', 'cancelled', 'canceled')
      AND (v_old_owner IS NULL OR inviter_user_id = v_old_owner);

    UPDATE public.order_transfer_requests
    SET status = 'cancelled', updated_at = now()
    WHERE order_id = v_order.id
      AND status IN ('pending_manager', 'manager_approved', 'pending_recipient', 'pending_registration');

    v_statements := array_append(v_statements, v_new_statement_id);
    IF v_order.statement_id IS NOT NULL THEN
      v_statements := array_append(v_statements, v_order.statement_id);
    END IF;
    IF v_old_owner IS NOT NULL THEN
      v_old_owners := array_append(v_old_owners, v_old_owner);
    END IF;
    v_codes := array_append(v_codes, coalesce(v_order.code, ''));
    v_moved := v_moved + 1;
  END LOOP;

  FOR v_sid IN SELECT DISTINCT s FROM unnest(v_statements) s WHERE s IS NOT NULL LOOP
    PERFORM public.recalc_customer_statement(v_sid);
  END LOOP;

  IF v_moved > 0 THEN
    INSERT INTO public.notifications (user_id, title, body, type, link)
    VALUES (v_target_user_id, 'سفارش‌های جدید به شما منتقل شد',
      v_moved || ' سفارش (' || array_to_string(v_codes, '، ') || ') توسط مدیریت اهرم به حساب شما منتقل شد.',
      'transfer_update', '/user/orders');

    FOR v_uid IN SELECT DISTINCT u FROM unnest(v_old_owners) u LOOP
      INSERT INTO public.notifications (user_id, title, body, type, link)
      VALUES (v_uid, 'انتقال سفارش',
        'سفارش‌های شما توسط مدیریت اهرم به مشتری دیگری منتقل شد.',
        'transfer_update', '/user/orders');
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'moved', v_moved,
    'skipped', v_skipped,
    'customer_id', v_customer_id,
    'target_name', v_target_name
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.manager_transfer_orders_to_customer(uuid[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.manager_transfer_orders_to_customer(uuid[], text) TO authenticated, service_role;