
-- Update the approve_order_as_sales_manager function to set status to pending_execution instead of approved
CREATE OR REPLACE FUNCTION public.approve_order_as_sales_manager(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid;
BEGIN
  _user_id := auth.uid();
  
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.has_role(_user_id, 'sales_manager'::app_role) THEN
    RAISE EXCEPTION 'Only sales managers can approve orders';
  END IF;

  -- تغییر status به pending_execution به جای approved
  UPDATE public.projects_v3
  SET status = 'pending_execution'::project_status_v3,
      approved_by = _user_id,
      approved_at = now()
  WHERE id = _order_id;

  PERFORM public.log_audit(
    'approve_order',
    'projects_v3',
    _order_id::text,
    jsonb_build_object('approved_by', _user_id)
  );
END;
$$;
