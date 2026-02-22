
-- 1. Update get_my_projects_v3 to match by phone and include pending_registration
CREATE OR REPLACE FUNCTION public.get_my_projects_v3()
RETURNS SETOF projects_v3
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.*
  FROM projects_v3 p
  JOIN customers c ON c.id = p.customer_id
  WHERE c.user_id = auth.uid()
    AND (p.is_archived IS NULL OR p.is_archived = false)
    AND (p.is_deep_archived IS NULL OR p.is_deep_archived = false)
  
  UNION
  
  SELECT p.*
  FROM projects_v3 p
  JOIN order_transfer_requests otr ON otr.order_id = p.id
  WHERE otr.status IN ('pending_recipient', 'pending_registration', 'accepted', 'completed')
    AND (
      otr.to_user_id = auth.uid()
      OR otr.to_phone_number = (SELECT phone_number FROM profiles WHERE user_id = auth.uid() LIMIT 1)
    )
    AND (p.is_archived IS NULL OR p.is_archived = false)
    AND (p.is_deep_archived IS NULL OR p.is_deep_archived = false);
$$;

-- 2. Drop and recreate get_incoming_transfer_requests to include pending_registration
DROP FUNCTION IF EXISTS public.get_incoming_transfer_requests();

CREATE FUNCTION public.get_incoming_transfer_requests()
RETURNS TABLE(
  id uuid,
  order_id uuid,
  from_user_id uuid,
  to_user_id uuid,
  to_phone_number text,
  status text,
  created_at timestamptz,
  from_full_name text,
  from_phone_number text,
  order_code text,
  order_status text,
  order_address text,
  order_detailed_address text,
  order_notes text,
  order_subcategory_id uuid,
  subcategory_name text,
  service_type_name text,
  province_id uuid,
  district_id uuid,
  location_lat double precision,
  location_lng double precision,
  payment_amount numeric,
  execution_stage text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_phone text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT p.phone_number
    INTO v_phone
  FROM public.profiles p
  WHERE p.user_id = v_user_id
  LIMIT 1;

  RETURN QUERY
  SELECT
    r.id,
    r.order_id,
    r.from_user_id,
    r.to_user_id,
    r.to_phone_number,
    r.status,
    r.created_at,
    fp.full_name AS from_full_name,
    fp.phone_number AS from_phone_number,
    o.code AS order_code,
    o.status::text AS order_status,
    o.address AS order_address,
    o.detailed_address AS order_detailed_address,
    o.notes::text AS order_notes,
    o.subcategory_id AS order_subcategory_id,
    sc.name AS subcategory_name,
    st.name AS service_type_name,
    o.province_id,
    o.district_id,
    o.location_lat,
    o.location_lng,
    o.payment_amount,
    o.execution_stage::text AS execution_stage
  FROM public.order_transfer_requests r
  LEFT JOIN public.projects_v3 o ON o.id = r.order_id
  LEFT JOIN public.subcategories sc ON sc.id = o.subcategory_id
  LEFT JOIN public.service_types_v3 st ON st.id = sc.service_type_id
  LEFT JOIN public.profiles fp ON fp.user_id = r.from_user_id
  WHERE r.status IN ('pending_recipient', 'pending_registration')
    AND (
      r.to_user_id = v_user_id
      OR (v_phone IS NOT NULL AND r.to_phone_number = v_phone)
    )
  ORDER BY r.created_at DESC;
END;
$$;

-- 3. Drop and recreate get_incoming_transfer_request_media to also support pending_registration
DROP FUNCTION IF EXISTS public.get_incoming_transfer_request_media(uuid);

CREATE FUNCTION public.get_incoming_transfer_request_media(p_request_id uuid)
RETURNS TABLE(id uuid, file_path text, file_type text, created_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_phone text;
  v_order_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT p.phone_number INTO v_phone
  FROM public.profiles p WHERE p.user_id = v_user_id LIMIT 1;

  SELECT r.order_id INTO v_order_id
  FROM public.order_transfer_requests r
  WHERE r.id = p_request_id
    AND r.status IN ('pending_recipient', 'pending_registration')
    AND (
      r.to_user_id = v_user_id
      OR (v_phone IS NOT NULL AND r.to_phone_number = v_phone)
    )
  LIMIT 1;

  IF v_order_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT m.id, m.file_path, m.file_type, m.created_at
  FROM public.project_media m
  WHERE m.project_id = v_order_id
  ORDER BY m.created_at ASC;
END;
$$;

-- 4. Update transfer_order_ownership to accept pending_registration
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
SET search_path = public
AS $$
DECLARE
  v_transfer_request_exists BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1
    FROM order_transfer_requests otr
    WHERE otr.order_id = p_order_id
      AND otr.status IN ('pending_recipient', 'pending_registration')
      AND (
        otr.to_user_id = auth.uid()
        OR otr.to_phone_number = (
          SELECT phone_number FROM profiles WHERE user_id = auth.uid() LIMIT 1
        )
      )
  ) INTO v_transfer_request_exists;
  
  IF NOT v_transfer_request_exists THEN
    RAISE EXCEPTION 'Unauthorized: No valid transfer request found for this user';
  END IF;
  
  UPDATE projects_v3
  SET 
    customer_id = p_new_customer_id,
    hierarchy_project_id = p_new_hierarchy_id,
    transferred_from_user_id = p_transferred_from_user_id,
    transferred_from_phone = p_transferred_from_phone
  WHERE id = p_order_id;
  
  UPDATE order_transfer_requests
  SET status = 'completed', responded_at = NOW()
  WHERE order_id = p_order_id 
    AND status IN ('pending_recipient', 'pending_registration')
    AND (
      to_user_id = auth.uid()
      OR to_phone_number = (
        SELECT phone_number FROM profiles WHERE user_id = auth.uid() LIMIT 1
      )
    );
END;
$$;
