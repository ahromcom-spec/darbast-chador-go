
CREATE OR REPLACE FUNCTION public.reject_order(_order_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _current_notes jsonb;
  _updated_notes jsonb;
  _allowed boolean;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  IF _reason IS NULL OR length(btrim(_reason)) = 0 THEN
    RAISE EXCEPTION 'rejection_reason_required';
  END IF;

  SELECT (
    has_role(_uid, 'admin'::app_role) OR
    has_role(_uid, 'ceo'::app_role) OR
    has_role(_uid, 'general_manager'::app_role) OR
    has_role(_uid, 'sales_manager'::app_role) OR
    has_role(_uid, 'scaffold_executive_manager'::app_role) OR
    has_role(_uid, 'executive_manager_scaffold_execution_with_materials'::app_role) OR
    has_role(_uid, 'rental_executive_manager'::app_role) OR
    has_role(_uid, 'finance_manager'::app_role)
  ) INTO _allowed;

  IF NOT _allowed THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT COALESCE(
    CASE
      WHEN notes IS NULL OR length(btrim(notes)) = 0 THEN '{}'::jsonb
      ELSE notes::jsonb
    END, '{}'::jsonb)
  INTO _current_notes
  FROM projects_v3 WHERE id = _order_id;

  IF _current_notes IS NULL THEN
    RAISE EXCEPTION 'order_not_found';
  END IF;

  _updated_notes := _current_notes || jsonb_build_object(
    'rejection_reason', _reason,
    'rejected_at', now(),
    'rejected_by', _uid
  );

  UPDATE projects_v3
  SET status = 'rejected'::project_status_v3,
      rejection_reason = _reason,
      notes = _updated_notes::text
  WHERE id = _order_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reject_order(uuid, text) TO authenticated;
