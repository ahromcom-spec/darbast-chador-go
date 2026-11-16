CREATE OR REPLACE FUNCTION public.is_pending_order_invitee(_order_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT _user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.order_collaborators oc
    WHERE oc.order_id = _order_id
      AND oc.status IN ('pending','manager_approved','pending_registration')
      AND (
        oc.invitee_user_id = _user_id
        OR oc.invitee_phone_number = (SELECT p.phone_number FROM public.profiles p WHERE p.user_id = _user_id LIMIT 1)
      )
  );
$$;

DROP POLICY IF EXISTS "Pending invitees can preview invited orders" ON public.projects_v3;
CREATE POLICY "Pending invitees can preview invited orders"
ON public.projects_v3 FOR SELECT TO authenticated
USING (public.is_pending_order_invitee(id, auth.uid()));

DROP POLICY IF EXISTS "Pending invitees can preview invited order media" ON public.project_media;
CREATE POLICY "Pending invitees can preview invited order media"
ON public.project_media FOR SELECT TO authenticated
USING (public.is_pending_order_invitee(project_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.get_my_pending_collaboration_invites()
RETURNS TABLE(
  id uuid, order_id uuid, inviter_user_id uuid, status text, invited_at timestamptz,
  can_view_financials boolean, can_manage_order boolean,
  collaborator_name text, collaborator_role text,
  inviter_name text, inviter_phone text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT oc.id, oc.order_id, oc.inviter_user_id, oc.status, oc.invited_at,
         oc.can_view_financials, oc.can_manage_order,
         oc.collaborator_name, oc.collaborator_role,
         prof.full_name, prof.phone_number
  FROM public.order_collaborators oc
  LEFT JOIN public.profiles prof ON prof.user_id = oc.inviter_user_id
  WHERE auth.uid() IS NOT NULL
    AND oc.status IN ('pending','manager_approved','pending_registration')
    AND (
      oc.invitee_user_id = auth.uid()
      OR oc.invitee_phone_number = (SELECT p.phone_number FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1)
    )
  ORDER BY oc.invited_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_my_pending_collaboration_invites() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_pending_collaboration_invites() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_order_customer_identity(p_order_id uuid)
 RETURNS TABLE(customer_name text, customer_phone text, customer_code text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
 SELECT COALESCE(NULLIF(p.customer_name,''), prof.full_name),
 COALESCE(NULLIF(p.customer_phone,''), prof.phone_number), prof.customer_code
 FROM public.projects_v3 p
 JOIN public.customers c ON c.id=p.customer_id
 LEFT JOIN public.profiles prof ON prof.user_id=c.user_id
 WHERE p.id=p_order_id AND auth.uid() IS NOT NULL AND (
 c.user_id=auth.uid()
 OR public.has_role(auth.uid(),'ceo') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'general_manager')
 OR EXISTS (SELECT 1 FROM public.order_collaborators oc WHERE oc.order_id=p.id AND oc.invitee_user_id=auth.uid() AND oc.status IN ('accepted','approved'))
 OR public.is_pending_order_invitee(p.id, auth.uid())
 OR ((public.has_role(auth.uid(),'scaffold_executive_manager') OR public.has_role(auth.uid(),'executive_manager_scaffold_execution_with_materials')) AND p.status IN ('approved','pending_execution','scheduled','in_progress','completed','paid','closed'))
 OR (public.has_role(auth.uid(),'rental_executive_manager') AND EXISTS (SELECT 1 FROM public.subcategories s WHERE s.id=p.subcategory_id AND s.code='30'))
 OR EXISTS (SELECT 1 FROM public.order_approvals a WHERE a.order_id=p.id AND a.approved_at IS NULL AND public.has_role(auth.uid(),a.approver_role::public.app_role))
 OR (public.has_role(auth.uid(),'sales_manager') AND p.status IN ('completed','paid','closed'))
 OR (public.has_role(auth.uid(),'finance_manager') AND p.status IN ('paid','closed'))
 OR EXISTS (SELECT 1 FROM public.staff_roles sr WHERE sr.user_id=auth.uid() AND sr.active AND p.status<>'draft')
 );
$function$;

CREATE OR REPLACE FUNCTION public.get_order_report_activity(p_order_id uuid)
 RETURNS TABLE(id uuid, order_id uuid, report_date date, activity_description text, team_name text, notes text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
WITH access AS (
 SELECT auth.uid() IS NOT NULL AND (
 EXISTS (SELECT 1 FROM public.projects_v3 p JOIN public.customers c ON c.id=p.customer_id WHERE p.id=p_order_id AND c.user_id=auth.uid())
 OR EXISTS (SELECT 1 FROM public.orders o WHERE o.id=p_order_id AND o.user_id=auth.uid())
 OR EXISTS (SELECT 1 FROM public.order_collaborators oc WHERE oc.order_id=p_order_id AND oc.invitee_user_id=auth.uid() AND oc.status IN ('accepted','approved'))
 OR public.is_pending_order_invitee(p_order_id, auth.uid())
 OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id=auth.uid() AND ur.role IN ('admin','ceo','general_manager','finance_manager','sales_manager','support_manager','scaffold_executive_manager','rental_executive_manager','executive_manager_scaffold_execution_with_materials'))
 ) AS allowed
), canonical AS (
 SELECT r.id, r.order_id, d.report_date, r.activity_description, r.team_name, r.notes
 FROM public.daily_report_orders r JOIN public.daily_reports d ON d.id=r.daily_report_id
 CROSS JOIN access a
 WHERE r.order_id=p_order_id AND (a.allowed OR (auth.uid() IS NOT NULL AND (d.created_by=auth.uid() OR public.is_assigned_to_module(auth.uid(),d.module_key::text))))
 AND (NULLIF(btrim(r.activity_description),'') IS NOT NULL OR NULLIF(btrim(r.notes),'') IS NOT NULL)
)
SELECT * FROM canonical
UNION ALL
SELECT l.id,l.order_id,l.report_date,l.activity_description,l.team_name,l.notes
FROM public.order_daily_logs l CROSS JOIN access a
WHERE l.order_id=p_order_id AND (a.allowed OR (auth.uid() IS NOT NULL AND l.created_by=auth.uid()))
AND (NULLIF(btrim(l.activity_description),'') IS NOT NULL OR NULLIF(btrim(l.notes),'') IS NOT NULL)
AND NOT EXISTS (SELECT 1 FROM public.daily_report_orders r JOIN public.daily_reports d ON d.id=r.daily_report_id WHERE r.order_id=p_order_id AND d.report_date=l.report_date)
ORDER BY report_date DESC, id;
$function$;