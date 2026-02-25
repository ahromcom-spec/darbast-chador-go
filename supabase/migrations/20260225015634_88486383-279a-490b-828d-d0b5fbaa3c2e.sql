CREATE OR REPLACE FUNCTION public.auto_complete_order_transfer(p_order_id uuid, p_recipient_user_id uuid, p_recipient_phone text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_subcategory RECORD;
  v_customer_id uuid;
  v_location_id uuid;
  v_hierarchy_id uuid;
  v_from_user_id uuid;
  v_from_phone text;
BEGIN
  v_from_user_id := auth.uid();
  IF v_from_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get order details
  SELECT * INTO v_order FROM projects_v3 WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  -- Get subcategory info
  SELECT id, name, service_type_id INTO v_subcategory 
  FROM subcategories WHERE id = v_order.subcategory_id;

  -- Get or create customer for recipient
  SELECT id INTO v_customer_id FROM customers WHERE user_id = p_recipient_user_id;
  IF v_customer_id IS NULL THEN
    INSERT INTO customers (user_id) VALUES (p_recipient_user_id) RETURNING id INTO v_customer_id;
  END IF;

  -- Create location for recipient
  INSERT INTO locations (
    user_id, address_line, title, lat, lng, province_id, district_id
  ) VALUES (
    p_recipient_user_id,
    COALESCE(v_order.address, 'آدرس انتقالی'),
    COALESCE(v_order.detailed_address, 'آدرس انتقالی'),
    COALESCE(v_order.location_lat, 34.6401),
    COALESCE(v_order.location_lng, 50.8764),
    v_order.province_id,
    v_order.district_id
  ) RETURNING id INTO v_location_id;

  -- Create hierarchy project for recipient
  INSERT INTO projects_hierarchy (
    user_id, location_id, service_type_id, subcategory_id, title, status
  ) VALUES (
    p_recipient_user_id,
    v_location_id,
    v_subcategory.service_type_id,
    v_order.subcategory_id,
    'پروژه انتقالی - ' || v_order.code,
    'active'
  ) RETURNING id INTO v_hierarchy_id;

  -- Get sender phone
  SELECT phone_number INTO v_from_phone FROM profiles WHERE user_id = v_from_user_id LIMIT 1;

  -- Transfer order ownership
  UPDATE projects_v3
  SET 
    customer_id = v_customer_id,
    hierarchy_project_id = v_hierarchy_id,
    transferred_from_user_id = v_from_user_id,
    transferred_from_phone = v_from_phone
  WHERE id = p_order_id;

  -- Update transfer request to completed (fixed column name)
  UPDATE order_transfer_requests
  SET status = 'completed', recipient_responded_at = NOW()
  WHERE order_id = p_order_id 
    AND from_user_id = v_from_user_id
    AND status IN ('pending_recipient', 'pending_registration');

  RETURN jsonb_build_object(
    'success', true,
    'customer_id', v_customer_id,
    'location_id', v_location_id,
    'hierarchy_id', v_hierarchy_id
  );
END;
$$;