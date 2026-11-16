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
         (CASE
            WHEN NULLIF(btrim(p.full_name), '') IS NOT NULL
                 AND NULLIF(btrim(oc.collaborator_name), '') IS NOT NULL
                 AND btrim(oc.collaborator_name) <> btrim(p.full_name)
              THEN btrim(p.full_name) || ' (' || btrim(oc.collaborator_name) || ')'
            ELSE COALESCE(NULLIF(btrim(p.full_name), ''), NULLIF(btrim(oc.collaborator_name), ''), oc.invitee_phone_number)
          END)::text,
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