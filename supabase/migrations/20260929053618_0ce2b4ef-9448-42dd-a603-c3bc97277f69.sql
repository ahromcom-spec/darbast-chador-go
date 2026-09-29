CREATE TABLE public.scheduled_stage_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.projects_v3(id) ON DELETE CASCADE,
  target_stage text NOT NULL,
  target_label text,
  run_at timestamptz NOT NULL,
  state text NOT NULL DEFAULT 'pending',
  notify_customer boolean NOT NULL DEFAULT true,
  last_error text,
  executed_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ssc_pending ON public.scheduled_stage_changes(run_at) WHERE state = 'pending';
CREATE INDEX idx_ssc_order ON public.scheduled_stage_changes(order_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scheduled_stage_changes TO authenticated;
GRANT ALL ON public.scheduled_stage_changes TO service_role;
ALTER TABLE public.scheduled_stage_changes ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_schedule_stage_changes(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role IN (
    'admin','ceo','general_manager','operations_manager','sales_manager',
    'scaffold_executive_manager','executive_manager_scaffold_execution_with_materials','rental_executive_manager'))
    OR EXISTS (SELECT 1 FROM public.module_assignments ma JOIN public.profiles p ON p.phone_number = ma.assigned_phone_number
               WHERE p.user_id = _uid AND ma.is_active = true)
$$;

CREATE POLICY "Managers manage scheduled stage changes" ON public.scheduled_stage_changes
FOR ALL TO authenticated
USING (public.can_schedule_stage_changes(auth.uid()))
WITH CHECK (public.can_schedule_stage_changes(auth.uid()));