CREATE OR REPLACE FUNCTION public.trigger_assign_order_statement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_statement_id uuid;
  v_eligible boolean;
  v_current_customer uuid;
  v_current_scope_subcat uuid;
  v_current_scope_addr text;
  v_current_is_manual boolean;
BEGIN
  v_eligible := NEW.customer_id IS NOT NULL
                AND COALESCE(NEW.status::text, '') <> 'rejected'
                AND COALESCE(NEW.is_archived, false) = false
                AND COALESCE(NEW.is_deep_archived, false) = false;

  IF NOT v_eligible THEN
    RETURN NEW;
  END IF;

  IF NEW.statement_id IS NOT NULL THEN
    SELECT customer_id, subcategory_id, address, COALESCE(is_manual, false)
      INTO v_current_customer, v_current_scope_subcat, v_current_scope_addr, v_current_is_manual
    FROM public.customer_statements
    WHERE id = NEW.statement_id;

    IF v_current_customer = NEW.customer_id
       AND (
         v_current_is_manual = true
         OR (
           COALESCE(v_current_scope_subcat::text,'') = COALESCE(NEW.subcategory_id::text,'')
           AND COALESCE(v_current_scope_addr,'') = COALESCE(NEW.address,'')
         )
       ) THEN
      RETURN NEW;
    END IF;
  END IF;

  v_statement_id := public.get_or_create_open_statement(
    NEW.customer_id, NEW.subcategory_id, NEW.address, NEW.detailed_address
  );
  NEW.statement_id := v_statement_id;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.transfer_order_to_statement(_order_id uuid, _target_statement_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_source_statement uuid;
  v_order_customer uuid;
  v_target_customer uuid;
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

  SELECT statement_id, customer_id
    INTO v_source_statement, v_order_customer
  FROM public.projects_v3
  WHERE id = _order_id;

  IF v_order_customer IS NULL THEN
    RAISE EXCEPTION 'سفارش پیدا نشد';
  END IF;

  SELECT customer_id
    INTO v_target_customer
  FROM public.customer_statements
  WHERE id = _target_statement_id;

  IF v_target_customer IS NULL THEN
    RAISE EXCEPTION 'صورتحساب مقصد پیدا نشد';
  END IF;

  IF v_target_customer <> v_order_customer THEN
    RAISE EXCEPTION 'صورتحساب مقصد متعلق به مشتری دیگری است';
  END IF;

  IF v_source_statement = _target_statement_id THEN
    RETURN;
  END IF;

  UPDATE public.customer_statements
  SET is_manual = true
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

GRANT EXECUTE ON FUNCTION public.transfer_order_to_statement(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_order_to_statement(uuid, uuid) TO service_role;