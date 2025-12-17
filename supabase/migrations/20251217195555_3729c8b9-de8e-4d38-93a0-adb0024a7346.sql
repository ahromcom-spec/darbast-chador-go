CREATE OR REPLACE FUNCTION public.get_incoming_transfer_request_media(p_request_id uuid)
RETURNS TABLE(
  id uuid,
  file_path text,
  file_type text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

  SELECT p.phone_number
    INTO v_phone
  FROM public.profiles p
  WHERE p.user_id = v_user_id
  LIMIT 1;

  SELECT r.order_id
    INTO v_order_id
  FROM public.order_transfer_requests r
  WHERE r.id = p_request_id
    AND r.status = 'pending_recipient'
    AND (
      r.to_user_id = v_user_id
      OR (v_phone IS NOT NULL AND r.to_phone_number = v_phone)
    )
  LIMIT 1;

  -- If request doesn't belong to this user, return empty set
  IF v_order_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT m.id, m.file_path, m.file_type, m.created_at
  FROM public.project_media m
  WHERE m.project_id = v_order_id
  ORDER BY m.created_at ASC;
END;
$$;