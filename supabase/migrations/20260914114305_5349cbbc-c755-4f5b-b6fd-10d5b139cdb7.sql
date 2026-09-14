-- 1) Full ownership transfer (recipient accepts)
CREATE OR REPLACE FUNCTION public.transfer_order_ownership(
  p_order_id uuid,
  p_new_customer_id uuid,
  p_new_hierarchy_id uuid,
  p_transferred_from_user_id uuid,
  p_transferred_from_phone text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_phone text;
  v_exists boolean;
  v_old_customer_id uuid;
  v_old_statement_id uuid;
  v_old_owner_user_id uuid;
  v_new_statement_id uuid;
  v_order RECORD;
  v_new_name text;
  v_new_phone text;
BEGIN
  SELECT phone_number INTO v_user_phone
  FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;

  SELECT EXISTS(
    SELECT 1 FROM public.order_transfer_requests otr
    WHERE otr.order_id = p_order_id
      AND otr.status IN ('pending_recipient', 'pending_registration')
      AND (otr.to_user_id = auth.uid()
           OR (v_user_phone IS NOT NULL AND otr.to_phone_number = v_user_phone))
  ) INTO v_exists;

  IF NOT v_exists THEN
    RAISE EXCEPTION 'Unauthorized: No valid transfer request found for this user';
  END IF;

  SELECT * INTO v_order FROM public.projects_v3 WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  v_old_customer_id := v_order.customer_id;
  v_old_statement_id := v_order.statement_id;
  SELECT user_id INTO v_old_owner_user_id FROM public.customers WHERE id = v_old_customer_id;

  SELECT full_name, phone_number INTO v_new_name, v_new_phone
  FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;

  -- destination statement for the new owner
  v_new_statement_id := public.get_or_create_open_statement(
    p_new_customer_id, v_order.subcategory_id, v_order.address, v_order.detailed_address
  );

  UPDATE public.projects_v3
  SET customer_id = p_new_customer_id,
      hierarchy_project_id = p_new_hierarchy_id,
      transferred_from_user_id = p_transferred_from_user_id,
      transferred_from_phone = p_transferred_from_phone,
      customer_name = COALESCE(v_new_name, customer_name),
      customer_phone = COALESCE(v_new_phone, customer_phone),
      statement_id = v_new_statement_id,
      updated_at = now()
  WHERE id = p_order_id;

  -- old owner and their collaborators lose access
  UPDATE public.order_collaborators
  SET status = 'exited', updated_at = now()
  WHERE order_id = p_order_id
    AND status NOT IN ('exited', 'rejected', 'manager_rejected', 'cancelled', 'canceled')
    AND (v_old_owner_user_id IS NULL OR inviter_user_id = v_old_owner_user_id);

  UPDATE public.order_transfer_requests
  SET status = 'completed',
      to_user_id = auth.uid(),
      recipient_responded_at = now(),
      updated_at = now()
  WHERE order_id = p_order_id
    AND status IN ('pending_recipient', 'pending_registration')
    AND (to_user_id = auth.uid()
         OR (v_user_phone IS NOT NULL AND to_phone_number = v_user_phone));

  UPDATE public.order_transfer_requests
  SET status = 'cancelled', updated_at = now()
  WHERE order_id = p_order_id
    AND status IN ('pending_manager', 'manager_approved', 'pending_recipient', 'pending_registration');

  -- audit amounts on both statements
  PERFORM public.recalc_customer_statement(v_new_statement_id);
  IF v_old_statement_id IS NOT NULL AND v_old_statement_id <> v_new_statement_id THEN
    PERFORM public.recalc_customer_statement(v_old_statement_id);
  END IF;

  IF v_old_owner_user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, body, type, link)
    VALUES (v_old_owner_user_id, 'انتقال سفارش تکمیل شد',
      'سفارش ' || COALESCE(v_order.code, '') || ' به کاربر مقصد منتقل شد و از حساب شما خارج گردید.',
      'transfer_update', '/user/orders');
  END IF;
END;
$function$;

-- 2) Manager-initiated direct transfer to another customer
CREATE OR REPLACE FUNCTION public.manager_transfer_order_to_customer(
  p_order_id uuid,
  p_phone text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order RECORD;
  v_target_user_id uuid;
  v_target_name text;
  v_target_phone text;
  v_customer_id uuid;
  v_location_id uuid;
  v_hierarchy_id uuid;
  v_service_type_id uuid;
  v_old_customer_id uuid;
  v_old_owner_user_id uuid;
  v_old_statement_id uuid;
  v_new_statement_id uuid;
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

  SELECT * INTO v_order FROM public.projects_v3 WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'سفارش پیدا نشد';
  END IF;

  SELECT user_id, full_name, phone_number
    INTO v_target_user_id, v_target_name, v_target_phone
  FROM public.profiles WHERE phone_number = p_phone LIMIT 1;

  IF v_target_user_id IS NULL THEN
    RAISE EXCEPTION 'مشتری با این شماره تلفن ثبت‌نام نکرده است';
  END IF;

  v_old_customer_id := v_order.customer_id;
  v_old_statement_id := v_order.statement_id;
  SELECT user_id INTO v_old_owner_user_id FROM public.customers WHERE id = v_old_customer_id;

  IF v_old_owner_user_id = v_target_user_id THEN
    RAISE EXCEPTION 'این سفارش از قبل متعلق به همین مشتری است';
  END IF;

  SELECT id INTO v_customer_id FROM public.customers WHERE user_id = v_target_user_id;
  IF v_customer_id IS NULL THEN
    INSERT INTO public.customers (user_id) VALUES (v_target_user_id) RETURNING id INTO v_customer_id;
  END IF;

  SELECT service_type_id INTO v_service_type_id FROM public.subcategories WHERE id = v_order.subcategory_id;

  INSERT INTO public.locations (user_id, address_line, title, lat, lng, province_id, district_id)
  VALUES (
    v_target_user_id,
    COALESCE(v_order.address, 'آدرس انتقالی'),
    COALESCE(v_order.detailed_address, 'آدرس انتقالی'),
    COALESCE(v_order.location_lat, 34.6401),
    COALESCE(v_order.location_lng, 50.8764),
    v_order.province_id,
    v_order.district_id
  ) RETURNING id INTO v_location_id;

  INSERT INTO public.projects_hierarchy (user_id, location_id, service_type_id, subcategory_id, title, status)
  VALUES (
    v_target_user_id, v_location_id, v_service_type_id, v_order.subcategory_id,
    'پروژه انتقالی - ' || COALESCE(v_order.code, ''), 'active'
  ) RETURNING id INTO v_hierarchy_id;

  v_new_statement_id := public.get_or_create_open_statement(
    v_customer_id, v_order.subcategory_id, v_order.address, v_order.detailed_address
  );

  UPDATE public.projects_v3
  SET customer_id = v_customer_id,
      hierarchy_project_id = v_hierarchy_id,
      transferred_from_user_id = v_old_owner_user_id,
      transferred_from_phone = v_order.customer_phone,
      customer_name = COALESCE(v_target_name, customer_name),
      customer_phone = COALESCE(v_target_phone, p_phone),
      statement_id = v_new_statement_id,
      updated_at = now()
  WHERE id = p_order_id;

  UPDATE public.order_collaborators
  SET status = 'exited', updated_at = now()
  WHERE order_id = p_order_id
    AND status NOT IN ('exited', 'rejected', 'manager_rejected', 'cancelled', 'canceled')
    AND (v_old_owner_user_id IS NULL OR inviter_user_id = v_old_owner_user_id);

  UPDATE public.order_transfer_requests
  SET status = 'cancelled', updated_at = now()
  WHERE order_id = p_order_id
    AND status IN ('pending_manager', 'manager_approved', 'pending_recipient', 'pending_registration');

  PERFORM public.recalc_customer_statement(v_new_statement_id);
  IF v_old_statement_id IS NOT NULL AND v_old_statement_id <> v_new_statement_id THEN
    PERFORM public.recalc_customer_statement(v_old_statement_id);
  END IF;

  INSERT INTO public.notifications (user_id, title, body, type, link)
  VALUES (v_target_user_id, 'سفارش جدید به شما منتقل شد',
    'سفارش ' || COALESCE(v_order.code, '') || ' توسط مدیریت اهرم به حساب شما منتقل شد.',
    'transfer_update', '/user/orders/' || p_order_id);

  IF v_old_owner_user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, body, type, link)
    VALUES (v_old_owner_user_id, 'انتقال سفارش',
      'سفارش ' || COALESCE(v_order.code, '') || ' توسط مدیریت اهرم به مشتری دیگری منتقل شد.',
      'transfer_update', '/user/orders');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'customer_id', v_customer_id,
    'statement_id', v_new_statement_id,
    'target_name', v_target_name
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.manager_transfer_order_to_customer(uuid, text) TO authenticated;