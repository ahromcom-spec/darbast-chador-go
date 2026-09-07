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
    AND (p.is_deep_archived IS NULL OR p.is_deep_archived = false)

  UNION

  SELECT p.*
  FROM projects_v3 p
  JOIN order_transfer_requests otr ON otr.order_id = p.id
  WHERE otr.status IN ('pending_recipient', 'pending_registration', 'accepted', 'recipient_accepted', 'completed')
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
$function$;

CREATE OR REPLACE FUNCTION public.recalc_location_active_for_hierarchy(_hierarchy_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _loc uuid;
  _cnt int;
BEGIN
  IF _hierarchy_id IS NULL THEN RETURN; END IF;
  SELECT location_id INTO _loc FROM public.projects_hierarchy WHERE id = _hierarchy_id;
  IF _loc IS NULL THEN RETURN; END IF;
  SELECT count(*) INTO _cnt
  FROM public.projects_v3 p
  WHERE p.hierarchy_project_id = _hierarchy_id
    AND coalesce(p.is_deep_archived, false) = false
    AND p.status <> 'rejected';
  UPDATE public.locations SET is_active = (_cnt > 0) WHERE id = _loc;
END;
$$;

UPDATE public.locations l
SET is_active = EXISTS (
  SELECT 1 FROM public.projects_v3 p
  JOIN public.projects_hierarchy ph ON ph.id = p.hierarchy_project_id
  WHERE ph.location_id = l.id
    AND coalesce(p.is_deep_archived, false) = false
    AND p.status <> 'rejected'
)
WHERE EXISTS (SELECT 1 FROM public.projects_hierarchy ph2 WHERE ph2.location_id = l.id);