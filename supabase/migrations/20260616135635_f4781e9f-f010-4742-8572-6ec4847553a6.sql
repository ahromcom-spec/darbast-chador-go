
CREATE OR REPLACE FUNCTION public.transfer_order_to_statement(_order_id uuid, _target_statement_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_source_statement uuid;
  v_order_customer uuid;
  v_order_subcat uuid;
  v_order_address text;
  v_order_detailed text;
  v_target_customer uuid;
  v_target_status text;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'ceo'::app_role) OR
    public.has_role(auth.uid(), 'general_manager'::app_role) OR
    public.has_role(auth.uid(), 'finance_manager'::app_role) OR
    public.has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR
    public.has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role) OR
    public.has_role(auth.uid(), 'rental_executive_manager'::app_role)
  ) THEN
    RAISE EXCEPTION 'دسترسی غیرمجاز برای انتقال سفارش';
  END IF;

  SELECT statement_id, customer_id, subcategory_id, address, detailed_address
    INTO v_source_statement, v_order_customer, v_order_subcat, v_order_address, v_order_detailed
  FROM public.projects_v3 WHERE id = _order_id;

  IF v_order_customer IS NULL THEN
    RAISE EXCEPTION 'سفارش پیدا نشد';
  END IF;

  SELECT customer_id, status INTO v_target_customer, v_target_status
  FROM public.customer_statements WHERE id = _target_statement_id;

  IF v_target_customer IS NULL THEN
    RAISE EXCEPTION 'صورتحساب مقصد پیدا نشد';
  END IF;

  IF v_target_customer <> v_order_customer THEN
    RAISE EXCEPTION 'صورتحساب مقصد متعلق به مشتری دیگری است';
  END IF;

  IF v_source_statement = _target_statement_id THEN
    RETURN;
  END IF;

  -- Align target statement scope to the order's scope so the
  -- auto-assignment trigger does NOT bounce the order back.
  UPDATE public.customer_statements
  SET subcategory_id   = v_order_subcat,
      address          = v_order_address,
      detailed_address = v_order_detailed
  WHERE id = _target_statement_id;

  UPDATE public.projects_v3
  SET statement_id = _target_statement_id
  WHERE id = _order_id;

  PERFORM public.recalc_customer_statement(_target_statement_id);
  IF v_source_statement IS NOT NULL THEN
    PERFORM public.recalc_customer_statement(v_source_statement);
  END IF;
END;
$function$;
