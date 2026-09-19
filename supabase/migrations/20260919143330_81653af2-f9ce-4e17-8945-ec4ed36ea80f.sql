CREATE OR REPLACE FUNCTION public.get_order_notification_recipients(_order_id uuid)
RETURNS TABLE(user_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT u.user_id
  FROM (
    -- owner of the order (current customer)
    SELECT c.user_id
    FROM public.projects_v3 p
    JOIN public.customers c ON c.id = p.customer_id
    WHERE p.id = _order_id

    UNION

    -- accepted collaborators (by user id)
    SELECT oc.invitee_user_id
    FROM public.order_collaborators oc
    WHERE oc.order_id = _order_id
      AND oc.status IN ('accepted', 'approved')

    UNION

    -- accepted collaborators invited by phone only
    SELECT pr.user_id
    FROM public.order_collaborators oc
    JOIN public.profiles pr ON pr.phone_number = oc.invitee_phone_number
    WHERE oc.order_id = _order_id
      AND oc.status IN ('accepted', 'approved')
  ) AS u
  WHERE u.user_id IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION public.get_order_notification_recipients(uuid) TO authenticated, service_role;