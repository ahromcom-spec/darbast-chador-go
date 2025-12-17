-- Allow recipients to see full details of "order for others" / transfer requests BEFORE accepting.
-- We avoid complex RLS recursion by exposing a SECURITY DEFINER RPC that enforces access via auth.uid() + phone match.

CREATE OR REPLACE FUNCTION public.get_incoming_transfer_requests()
RETURNS TABLE (
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
    o.notes AS order_notes,
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
  WHERE r.status = 'pending_recipient'
    AND (
      r.to_user_id = v_user_id
      OR (v_phone IS NOT NULL AND r.to_phone_number = v_phone)
    )
  ORDER BY r.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_incoming_transfer_requests() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_incoming_transfer_requests() TO authenticated;
