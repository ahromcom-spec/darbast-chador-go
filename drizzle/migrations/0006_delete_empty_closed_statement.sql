CREATE OR REPLACE FUNCTION public.delete_empty_closed_statement(_statement_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE v_status text;
BEGIN
 IF auth.uid() IS NULL OR NOT (
 public.has_role(auth.uid(), 'ceo'::public.app_role) OR public.has_role(auth.uid(), 'general_manager'::public.app_role) OR
 public.has_role(auth.uid(), 'finance_manager'::public.app_role) OR public.has_role(auth.uid(), 'scaffold_executive_manager'::public.app_role) OR
 public.has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::public.app_role) OR
 public.has_role(auth.uid(), 'rental_executive_manager'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)
 ) THEN RAISE EXCEPTION 'دسترسی غیرمجاز برای حذف صورتحساب'; END IF;
 SELECT status INTO v_status FROM public.customer_statements WHERE id = _statement_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'صورتحساب پیدا نشد'; END IF;
 IF v_status IS DISTINCT FROM 'closed' THEN RAISE EXCEPTION 'فقط صورتحساب بسته قابل حذف است'; END IF;
 IF EXISTS (SELECT 1 FROM public.projects_v3 WHERE statement_id = _statement_id) THEN
 RAISE EXCEPTION 'صورتحساب دارای سفارش قابل حذف نیست، حتی سفارش ردشده یا بایگانی‌شده'; END IF;
 IF EXISTS (SELECT 1 FROM public.cheques WHERE statement_id = _statement_id) OR
 EXISTS (SELECT 1 FROM public.payment_submissions WHERE statement_id = _statement_id) THEN
 RAISE EXCEPTION 'این صورتحساب دارای چک یا سابقه درخواست پرداخت است و برای حفظ سوابق مالی قابل حذف نیست'; END IF;
 DELETE FROM public.customer_statements WHERE id = _statement_id;
 RETURN _statement_id;
END;
$function$;
REVOKE ALL ON FUNCTION public.delete_empty_closed_statement(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_empty_closed_statement(uuid) TO authenticated;