CREATE OR REPLACE FUNCTION public.get_order_customer_identity(p_order_id uuid)
RETURNS TABLE(customer_name text, customer_phone text, customer_code text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
 SELECT COALESCE(NULLIF(p.customer_name,''), prof.full_name),
 COALESCE(NULLIF(p.customer_phone,''), prof.phone_number), prof.customer_code
 FROM public.projects_v3 p
 JOIN public.customers c ON c.id=p.customer_id
 LEFT JOIN public.profiles prof ON prof.user_id=c.user_id
 WHERE p.id=p_order_id AND auth.uid() IS NOT NULL AND (
 c.user_id=auth.uid()
 OR public.has_role(auth.uid(),'ceo') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'general_manager')
 OR EXISTS (SELECT 1 FROM public.order_collaborators oc WHERE oc.order_id=p.id AND oc.invitee_user_id=auth.uid() AND oc.status IN ('accepted','approved'))
 OR ((public.has_role(auth.uid(),'scaffold_executive_manager') OR public.has_role(auth.uid(),'executive_manager_scaffold_execution_with_materials')) AND p.status IN ('approved','pending_execution','scheduled','in_progress','completed','paid','closed'))
 OR (public.has_role(auth.uid(),'rental_executive_manager') AND EXISTS (SELECT 1 FROM public.subcategories s WHERE s.id=p.subcategory_id AND s.code='30'))
 OR EXISTS (SELECT 1 FROM public.order_approvals a WHERE a.order_id=p.id AND a.approved_at IS NULL AND public.has_role(auth.uid(),a.approver_role::public.app_role))
 OR (public.has_role(auth.uid(),'sales_manager') AND p.status IN ('completed','paid','closed'))
 OR (public.has_role(auth.uid(),'finance_manager') AND p.status IN ('paid','closed'))
 OR EXISTS (SELECT 1 FROM public.staff_roles sr WHERE sr.user_id=auth.uid() AND sr.active AND p.status<>'draft')
 );
$$;
REVOKE ALL ON FUNCTION public.get_order_customer_identity(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_order_customer_identity(uuid) TO authenticated, service_role;