CREATE OR REPLACE FUNCTION public.get_my_projects_v3()
RETURNS SETOF public.projects_v3
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.*
  FROM projects_v3 p
  JOIN customers c ON c.id = p.customer_id
  WHERE c.user_id = auth.uid()
    AND (p.is_deep_archived IS NULL OR p.is_deep_archived = false)

  UNION

  -- only pending transfers grant temporary visibility; after completion access follows ownership
  SELECT p.*
  FROM projects_v3 p
  JOIN order_transfer_requests otr ON otr.order_id = p.id
  WHERE otr.status IN ('pending_recipient', 'pending_registration')
    AND (
      otr.to_user_id = auth.uid()
      OR otr.to_phone_number = (SELECT phone_number FROM profiles WHERE user_id = auth.uid() LIMIT 1)
    )
    AND (p.is_deep_archived IS NULL OR p.is_deep_archived = false)

  UNION

  SELECT p.*
  FROM projects_v3 p
  JOIN order_collaborators oc ON oc.order_id = p.id
  WHERE oc.responded_at IS NOT NULL
    AND oc.manager_approved_at IS NOT NULL
    AND oc.status NOT IN ('pending', 'manager_approved', 'pending_registration', 'rejected', 'cancelled', 'canceled', 'exited')
    AND (
      oc.invitee_user_id = auth.uid()
      OR oc.invitee_phone_number = (SELECT phone_number FROM profiles WHERE user_id = auth.uid() LIMIT 1)
    )
    AND (p.is_deep_archived IS NULL OR p.is_deep_archived = false)
$$;