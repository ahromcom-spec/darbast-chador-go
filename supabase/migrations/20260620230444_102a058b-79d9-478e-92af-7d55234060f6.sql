
-- CEO & general_manager can manage all project assignments
CREATE POLICY "CEO can manage all assignments"
  ON public.project_assignments
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role));

-- CEO & general_manager can view all contractors
CREATE POLICY "CEO can view all contractors"
  ON public.contractors
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role));

CREATE POLICY "CEO can update all contractors"
  ON public.contractors
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role));

-- CEO & general_manager can view all service requests (needed for dispatching)
CREATE POLICY "CEO can view all service requests"
  ON public.service_requests
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role));

-- CEO can view all contractor services to filter dispatch
CREATE POLICY "CEO can view all contractor services"
  ON public.contractor_services
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role));

-- RPC: atomic accept assignment & cancel siblings (first-come-first-served)
CREATE OR REPLACE FUNCTION public.accept_contractor_assignment(_assignment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assignment record;
  v_contractor record;
BEGIN
  -- Lock the assignment row
  SELECT * INTO v_assignment FROM public.project_assignments
    WHERE id = _assignment_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'assignment_not_found');
  END IF;

  -- Verify the caller owns this contractor record
  SELECT * INTO v_contractor FROM public.contractors
    WHERE id = v_assignment.contractor_id AND user_id = auth.uid();
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authorized');
  END IF;

  IF v_assignment.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_processed', 'status', v_assignment.status);
  END IF;

  -- Check if any sibling already accepted
  IF EXISTS (
    SELECT 1 FROM public.project_assignments
    WHERE service_request_id = v_assignment.service_request_id
      AND status = 'accepted'
      AND id <> _assignment_id
  ) THEN
    UPDATE public.project_assignments
      SET status = 'cancelled', updated_at = now()
      WHERE id = _assignment_id;
    RETURN jsonb_build_object('success', false, 'error', 'taken_by_other');
  END IF;

  -- Accept this one
  UPDATE public.project_assignments
    SET status = 'accepted', accepted_at = now(), updated_at = now()
    WHERE id = _assignment_id;

  -- Cancel all other pending siblings
  UPDATE public.project_assignments
    SET status = 'cancelled', updated_at = now()
    WHERE service_request_id = v_assignment.service_request_id
      AND id <> _assignment_id
      AND status = 'pending';

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_contractor_assignment(uuid) TO authenticated;

-- RPC: reject an assignment (just mark as rejected)
CREATE OR REPLACE FUNCTION public.reject_contractor_assignment(_assignment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assignment record;
BEGIN
  SELECT pa.* INTO v_assignment FROM public.project_assignments pa
    JOIN public.contractors c ON c.id = pa.contractor_id
    WHERE pa.id = _assignment_id AND c.user_id = auth.uid();
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found_or_unauthorized');
  END IF;
  IF v_assignment.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_processed');
  END IF;
  UPDATE public.project_assignments
    SET status = 'rejected', updated_at = now()
    WHERE id = _assignment_id;
  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.reject_contractor_assignment(uuid) TO authenticated;
