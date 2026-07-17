-- Activity log table for contractor lifecycle events (approvals, rejections, service changes)
CREATE TABLE IF NOT EXISTS public.contractor_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id uuid REFERENCES public.contractors(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  event_type text NOT NULL,
  message text NOT NULL,
  performed_by uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.contractor_activity_log TO authenticated;
GRANT ALL ON public.contractor_activity_log TO service_role;

ALTER TABLE public.contractor_activity_log ENABLE ROW LEVEL SECURITY;

-- Contractor user can view their own log
CREATE POLICY "Users view own contractor log"
  ON public.contractor_activity_log FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admins / general managers / CEO view all
CREATE POLICY "Managers view all contractor logs"
  ON public.contractor_activity_log FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'general_manager')
    OR public.has_role(auth.uid(), 'ceo')
  );

-- Managers can insert log entries
CREATE POLICY "Managers insert contractor logs"
  ON public.contractor_activity_log FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'general_manager')
    OR public.has_role(auth.uid(), 'ceo')
  );

CREATE INDEX IF NOT EXISTS idx_contractor_activity_log_user ON public.contractor_activity_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contractor_activity_log_contractor ON public.contractor_activity_log(contractor_id, created_at DESC);