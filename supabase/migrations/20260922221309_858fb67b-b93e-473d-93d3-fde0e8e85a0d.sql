CREATE OR REPLACE FUNCTION public.restore_rejected_order(_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _status project_status_v3;
  _notes_text text;
  _notes jsonb;
  _history jsonb;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  IF NOT (
    has_role(_uid, 'admin'::app_role) OR
    has_role(_uid, 'ceo'::app_role) OR
    has_role(_uid, 'general_manager'::app_role) OR
    has_role(_uid, 'sales_manager'::app_role) OR
    has_role(_uid, 'scaffold_executive_manager'::app_role) OR
    has_role(_uid, 'executive_manager_scaffold_execution_with_materials'::app_role) OR
    has_role(_uid, 'rental_executive_manager'::app_role)
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT status, notes INTO _status, _notes_text FROM projects_v3 WHERE id = _order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found';
  END IF;
  IF _status <> 'rejected'::project_status_v3 THEN
    RAISE EXCEPTION 'order_not_rejected';
  END IF;

  BEGIN
    _notes := CASE WHEN _notes_text IS NULL OR length(btrim(_notes_text)) = 0 THEN '{}'::jsonb ELSE _notes_text::jsonb END;
  EXCEPTION WHEN others THEN
    _notes := NULL;
  END;

  IF _notes IS NOT NULL AND jsonb_typeof(_notes) = 'object' THEN
    _history := COALESCE(_notes->'rejection_history', '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'rejection_reason', _notes->'rejection_reason',
      'rejected_at', _notes->'rejected_at',
      'rejected_by', _notes->'rejected_by',
      'restored_at', now(),
      'restored_by', _uid
    ));
    _notes := (_notes - 'rejection_reason' - 'rejected_at' - 'rejected_by') || jsonb_build_object('rejection_history', _history);
    _notes_text := _notes::text;
  END IF;

  UPDATE projects_v3
  SET status = 'pending'::project_status_v3,
      rejection_reason = NULL,
      approved_at = NULL,
      approved_by = NULL,
      notes = _notes_text,
      updated_at = now()
  WHERE id = _order_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.restore_rejected_order(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_rejected_order(uuid) TO authenticated;