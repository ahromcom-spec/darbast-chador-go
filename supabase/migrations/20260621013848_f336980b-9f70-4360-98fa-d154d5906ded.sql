
-- Table to track offers/assignments of projects_v3 orders to contractors
CREATE TABLE IF NOT EXISTS public.project_v3_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects_v3(id) ON DELETE CASCADE,
  contractor_id uuid NOT NULL REFERENCES public.contractors(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending', -- pending | accepted | rejected | cancelled
  assignment_type text NOT NULL DEFAULT 'auto', -- auto | manual
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  rejected_at timestamptz,
  rejection_reason text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, contractor_id)
);

CREATE INDEX IF NOT EXISTS idx_pv3a_contractor ON public.project_v3_assignments(contractor_id, status);
CREATE INDEX IF NOT EXISTS idx_pv3a_project ON public.project_v3_assignments(project_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_v3_assignments TO authenticated;
GRANT ALL ON public.project_v3_assignments TO service_role;

ALTER TABLE public.project_v3_assignments ENABLE ROW LEVEL SECURITY;

-- Contractor can view their own assignments
CREATE POLICY "Contractors view own v3 assignments"
  ON public.project_v3_assignments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.contractors c WHERE c.id = contractor_id AND c.user_id = auth.uid()));

-- CEO/general_manager view all
CREATE POLICY "CEO view all v3 assignments"
  ON public.project_v3_assignments FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'ceo'::app_role) OR has_role(auth.uid(),'general_manager'::app_role));

-- CEO/general_manager manage all (manual dispatch / cancel)
CREATE POLICY "CEO manage v3 assignments"
  ON public.project_v3_assignments FOR ALL TO authenticated
  USING (has_role(auth.uid(),'ceo'::app_role) OR has_role(auth.uid(),'general_manager'::app_role))
  WITH CHECK (has_role(auth.uid(),'ceo'::app_role) OR has_role(auth.uid(),'general_manager'::app_role));

-- updated_at trigger
CREATE TRIGGER trg_pv3a_updated BEFORE UPDATE ON public.project_v3_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-dispatch trigger: on projects_v3 INSERT, create pending assignments for matching contractors
CREATE OR REPLACE FUNCTION public.auto_dispatch_projects_v3()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sub_code text;
BEGIN
  IF NEW.subcategory_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT code INTO v_sub_code FROM public.subcategories WHERE id = NEW.subcategory_id;
  IF v_sub_code IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.project_v3_assignments(project_id, contractor_id, status, assignment_type)
  SELECT NEW.id, c.id, 'pending', 'auto'
  FROM public.contractors c
  JOIN public.contractor_services cs ON cs.contractor_id = c.id
  WHERE c.is_active = true
    AND c.is_approved = true
    AND COALESCE(c.auto_assign_enabled,false) = true
    AND cs.service_type = (SELECT st.id::text FROM public.service_types_v3 st WHERE st.id = (SELECT service_type_id FROM public.subcategories WHERE id = NEW.subcategory_id))
    AND cs.sub_type = v_sub_code
  ON CONFLICT (project_id, contractor_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_dispatch_v3 ON public.projects_v3;
CREATE TRIGGER trg_auto_dispatch_v3 AFTER INSERT ON public.projects_v3
  FOR EACH ROW EXECUTE FUNCTION public.auto_dispatch_projects_v3();

-- RPC: contractor accepts a v3 assignment
CREATE OR REPLACE FUNCTION public.accept_v3_assignment(_assignment_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_a record;
  v_c record;
BEGIN
  SELECT * INTO v_a FROM public.project_v3_assignments WHERE id = _assignment_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'not_found'); END IF;

  SELECT * INTO v_c FROM public.contractors WHERE id = v_a.contractor_id AND user_id = auth.uid();
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'not_authorized'); END IF;

  IF v_a.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_processed');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.project_v3_assignments
    WHERE project_id = v_a.project_id AND status = 'accepted' AND id <> _assignment_id
  ) THEN
    UPDATE public.project_v3_assignments SET status='cancelled', updated_at=now() WHERE id = _assignment_id;
    RETURN jsonb_build_object('success', false, 'error', 'taken_by_other');
  END IF;

  UPDATE public.project_v3_assignments
    SET status='accepted', accepted_at=now(), updated_at=now()
    WHERE id = _assignment_id;

  UPDATE public.project_v3_assignments
    SET status='cancelled', updated_at=now()
    WHERE project_id = v_a.project_id AND id <> _assignment_id AND status = 'pending';

  -- attach contractor to the project
  UPDATE public.projects_v3 SET contractor_id = v_a.contractor_id, updated_at = now()
    WHERE id = v_a.project_id;

  RETURN jsonb_build_object('success', true);
END; $$;

GRANT EXECUTE ON FUNCTION public.accept_v3_assignment(uuid) TO authenticated;

-- RPC: contractor rejects a v3 assignment
CREATE OR REPLACE FUNCTION public.reject_v3_assignment(_assignment_id uuid, _reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_a record;
BEGIN
  SELECT pa.* INTO v_a FROM public.project_v3_assignments pa
    JOIN public.contractors c ON c.id = pa.contractor_id
    WHERE pa.id = _assignment_id AND c.user_id = auth.uid();
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'not_authorized'); END IF;
  IF v_a.status <> 'pending' THEN RETURN jsonb_build_object('success', false, 'error', 'already_processed'); END IF;

  UPDATE public.project_v3_assignments
    SET status='rejected', rejected_at=now(), rejection_reason=_reason, updated_at=now()
    WHERE id = _assignment_id;

  RETURN jsonb_build_object('success', true);
END; $$;

GRANT EXECUTE ON FUNCTION public.reject_v3_assignment(uuid, text) TO authenticated;

-- RPC: admin/CEO manually dispatch an order to one or more contractors
CREATE OR REPLACE FUNCTION public.manual_dispatch_v3(_project_id uuid, _contractor_ids uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cnt int := 0;
BEGIN
  IF NOT (has_role(auth.uid(),'ceo'::app_role) OR has_role(auth.uid(),'general_manager'::app_role)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authorized');
  END IF;

  INSERT INTO public.project_v3_assignments(project_id, contractor_id, status, assignment_type, assigned_by)
  SELECT _project_id, cid, 'pending', 'manual', auth.uid()
  FROM unnest(_contractor_ids) AS cid
  ON CONFLICT (project_id, contractor_id) DO UPDATE
    SET status = CASE WHEN public.project_v3_assignments.status IN ('rejected','cancelled')
                      THEN 'pending' ELSE public.project_v3_assignments.status END,
        assignment_type = 'manual',
        assigned_by = auth.uid(),
        assigned_at = now(),
        updated_at = now();

  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'count', v_cnt);
END; $$;

GRANT EXECUTE ON FUNCTION public.manual_dispatch_v3(uuid, uuid[]) TO authenticated;
