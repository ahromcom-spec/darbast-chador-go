
-- 1) Add per-service approval workflow columns on contractor_services
ALTER TABLE public.contractor_services
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='contractor_services_status_check') THEN
    ALTER TABLE public.contractor_services
      ADD CONSTRAINT contractor_services_status_check
      CHECK (status IN ('pending','approved','rejected'));
  END IF;
END $$;

-- Backfill: all pre-existing services are considered approved (they were live).
UPDATE public.contractor_services
   SET status = 'approved', approved_at = COALESCE(approved_at, created_at)
 WHERE status = 'pending' AND created_at < now() - interval '1 minute';

CREATE INDEX IF NOT EXISTS idx_contractor_services_status
  ON public.contractor_services(status);

-- 2) Restrict public visibility to APPROVED services only.
DROP POLICY IF EXISTS "Authenticated users can view services of approved contractors" ON public.contractor_services;
CREATE POLICY "Authenticated users can view services of approved contractors"
  ON public.contractor_services
  FOR SELECT
  TO authenticated
  USING (
    status = 'approved'
    AND EXISTS (
      SELECT 1 FROM public.contractors
       WHERE contractors.id = contractor_services.contractor_id
         AND contractors.is_approved = true
         AND contractors.is_active = true
    )
  );

-- 3) updated_at trigger
DROP TRIGGER IF EXISTS trg_contractor_services_updated ON public.contractor_services;
CREATE TRIGGER trg_contractor_services_updated
  BEFORE UPDATE ON public.contractor_services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Force contractor-inserted rows to status='pending' (contractors may not self-approve)
CREATE OR REPLACE FUNCTION public.contractor_services_enforce_pending()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If inserter is the contractor's own user (not admin/ceo/general_manager), force pending.
  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'ceo'::app_role)
    OR public.has_role(auth.uid(), 'general_manager'::app_role)
  ) THEN
    NEW.status := 'pending';
    NEW.approved_by := NULL;
    NEW.approved_at := NULL;
    NEW.rejection_reason := NULL;
  END IF;
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_contractor_services_enforce_pending ON public.contractor_services;
CREATE TRIGGER trg_contractor_services_enforce_pending
  BEFORE INSERT ON public.contractor_services
  FOR EACH ROW EXECUTE FUNCTION public.contractor_services_enforce_pending();

-- 5) Approve / reject helper RPCs for admins
CREATE OR REPLACE FUNCTION public.approve_contractor_service(_service_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'ceo'::app_role)
    OR public.has_role(auth.uid(), 'general_manager'::app_role)
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authorized');
  END IF;
  UPDATE public.contractor_services
     SET status = 'approved',
         approved_by = auth.uid(),
         approved_at = now(),
         rejection_reason = NULL
   WHERE id = _service_id;
  RETURN jsonb_build_object('success', true);
END; $$;

CREATE OR REPLACE FUNCTION public.reject_contractor_service(_service_id uuid, _reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'ceo'::app_role)
    OR public.has_role(auth.uid(), 'general_manager'::app_role)
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authorized');
  END IF;
  UPDATE public.contractor_services
     SET status = 'rejected',
         approved_by = auth.uid(),
         approved_at = now(),
         rejection_reason = COALESCE(_reason, 'رد شده توسط مدیریت')
   WHERE id = _service_id;
  RETURN jsonb_build_object('success', true);
END; $$;

-- 6) When a project_v3 gets a contractor assigned directly (e.g., by Ahrom staff), cancel all
--    still-pending assignment offers to other contractors so they disappear from their queue.
CREATE OR REPLACE FUNCTION public.cancel_pending_v3_assignments_on_contractor_set()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.contractor_id IS NOT NULL
     AND (OLD.contractor_id IS DISTINCT FROM NEW.contractor_id) THEN
    UPDATE public.project_v3_assignments
       SET status = 'cancelled', updated_at = now()
     WHERE project_id = NEW.id
       AND status = 'pending'
       AND contractor_id <> NEW.contractor_id;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_projects_v3_cancel_pending_assignments ON public.projects_v3;
CREATE TRIGGER trg_projects_v3_cancel_pending_assignments
  AFTER UPDATE OF contractor_id ON public.projects_v3
  FOR EACH ROW EXECUTE FUNCTION public.cancel_pending_v3_assignments_on_contractor_set();
