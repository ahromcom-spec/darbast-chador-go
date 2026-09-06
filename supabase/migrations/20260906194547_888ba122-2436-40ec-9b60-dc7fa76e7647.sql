CREATE OR REPLACE FUNCTION public.reopen_customer_statement(_statement_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_customer uuid;
  v_status text;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'ceo'::app_role) OR
    public.has_role(auth.uid(), 'general_manager'::app_role) OR
    public.has_role(auth.uid(), 'finance_manager'::app_role) OR
    public.has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR
    public.has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role) OR
    public.has_role(auth.uid(), 'rental_executive_manager'::app_role)
  ) THEN
    RAISE EXCEPTION 'دسترسی غیرمجاز برای بازگشایی صورتحساب';
  END IF;

  SELECT customer_id, status INTO v_customer, v_status
  FROM public.customer_statements
  WHERE id = _statement_id;

  IF v_customer IS NULL THEN
    RAISE EXCEPTION 'صورتحساب پیدا نشد';
  END IF;

  IF v_status = 'open' THEN
    RETURN _statement_id;
  END IF;

  UPDATE public.customer_statements
  SET status = 'open', closed_at = NULL, closed_by = NULL, updated_at = now()
  WHERE id = _statement_id;

  RETURN _statement_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.reopen_customer_statement(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reopen_customer_statement(uuid) TO service_role;