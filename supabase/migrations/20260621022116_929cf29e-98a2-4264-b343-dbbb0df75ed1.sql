
CREATE OR REPLACE FUNCTION public.cancel_v3_assignment(_assignment_id uuid, _reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_a record;
BEGIN
  SELECT pa.* INTO v_a FROM public.project_v3_assignments pa
    JOIN public.contractors c ON c.id = pa.contractor_id
    WHERE pa.id = _assignment_id AND c.user_id = auth.uid();
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'not_authorized'); END IF;
  IF v_a.status NOT IN ('pending','accepted') THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_processed');
  END IF;

  UPDATE public.project_v3_assignments
    SET status='cancelled', rejection_reason=COALESCE(_reason, rejection_reason), updated_at=now()
    WHERE id = _assignment_id;

  RETURN jsonb_build_object('success', true);
END; $$;

GRANT EXECUTE ON FUNCTION public.cancel_v3_assignment(uuid, text) TO authenticated;
