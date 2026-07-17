CREATE OR REPLACE FUNCTION public.get_my_projects_v3()
 RETURNS SETOF projects_v3
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    AND (p.is_deep_archived IS NULL OR p.is_deep_archived = false)

  UNION

  SELECT p.*
  FROM projects_v3 p
  JOIN order_collaborators oc ON oc.order_id = p.id
  WHERE oc.status = 'accepted'
    AND (
      oc.invitee_user_id = auth.uid()
      OR oc.invitee_phone_number = (SELECT phone_number FROM profiles WHERE user_id = auth.uid() LIMIT 1)
    )
    AND (p.is_archived IS NULL OR p.is_archived = false)
    AND (p.is_deep_archived IS NULL OR p.is_deep_archived = false);
$function$;