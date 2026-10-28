CREATE OR REPLACE FUNCTION public.get_order_report_activity(p_order_id uuid)
RETURNS TABLE(id uuid, order_id uuid, report_date date, activity_description text, team_name text, notes text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
WITH access AS (
 SELECT auth.uid() IS NOT NULL AND (
 EXISTS (SELECT 1 FROM public.projects_v3 p JOIN public.customers c ON c.id=p.customer_id WHERE p.id=p_order_id AND c.user_id=auth.uid())
 OR EXISTS (SELECT 1 FROM public.orders o WHERE o.id=p_order_id AND o.user_id=auth.uid())
 OR EXISTS (SELECT 1 FROM public.order_collaborators oc WHERE oc.order_id=p_order_id AND oc.invitee_user_id=auth.uid() AND oc.status IN ('accepted','approved'))
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
$$;
REVOKE ALL ON FUNCTION public.get_order_report_activity(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_order_report_activity(uuid) TO authenticated, service_role;
COMMENT ON FUNCTION public.get_order_report_activity(uuid) IS 'Order-scoped report activity from canonical daily report rows, with legacy fallback; excludes global report and personnel notes.';