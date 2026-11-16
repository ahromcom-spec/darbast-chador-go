ALTER TABLE public.order_collaborators ADD COLUMN IF NOT EXISTS sms_enabled boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.is_order_message_manager(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin','ceo','general_manager','sales_manager','scaffold_executive_manager',
                   'executive_manager_scaffold_execution_with_materials','rental_executive_manager')
  )
$$;

CREATE OR REPLACE FUNCTION public.get_order_collaborators_sms(_order_ids uuid[])
RETURNS TABLE(id uuid, order_id uuid, name text, phone text, collaborator_role text, sms_enabled boolean, sms_opted_out boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_order_message_manager(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT oc.id, oc.order_id,
         COALESCE(NULLIF(btrim(oc.collaborator_name), ''), NULLIF(btrim(p.full_name), ''), oc.invitee_phone_number)::text,
         COALESCE(NULLIF(btrim(oc.invitee_phone_number), ''), p.phone_number)::text,
         oc.collaborator_role::text,
         oc.sms_enabled,
         COALESCE(p.sms_notifications_enabled = false, false)
  FROM public.order_collaborators oc
  LEFT JOIN LATERAL (
    SELECT pr.full_name, pr.phone_number, pr.sms_notifications_enabled
    FROM public.profiles pr WHERE pr.user_id = oc.invitee_user_id LIMIT 1
  ) p ON true
  WHERE oc.order_id = ANY (_order_ids[1:500])
    AND oc.status = 'accepted'
  ORDER BY oc.invited_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_order_collaborator_sms(_collaborator_id uuid, _enabled boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_order_message_manager(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  UPDATE public.order_collaborators
     SET sms_enabled = _enabled
   WHERE id = _collaborator_id AND status = 'accepted';
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.is_order_message_manager(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_order_collaborators_sms(uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_order_collaborator_sms(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_order_message_manager(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_order_collaborators_sms(uuid[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_order_collaborator_sms(uuid, boolean) TO authenticated, service_role;