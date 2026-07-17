
-- Harden per-service approval: prevent contractors from self-approving via UPDATE,
-- and reset any pre-approved services to 'pending' so admins must approve each service individually.

-- 1) BEFORE UPDATE trigger: if the updater is not admin/ceo/general_manager,
--    lock the approval-related columns (status, approved_by, approved_at, rejection_reason).
CREATE OR REPLACE FUNCTION public.contractor_services_lock_status_on_update()
RETURNS TRIGGER
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
    -- Preserve prior approval state; contractors may only edit non-approval fields.
    NEW.status := OLD.status;
    NEW.approved_by := OLD.approved_by;
    NEW.approved_at := OLD.approved_at;
    NEW.rejection_reason := OLD.rejection_reason;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_contractor_services_lock_status ON public.contractor_services;
CREATE TRIGGER trg_contractor_services_lock_status
  BEFORE UPDATE ON public.contractor_services
  FOR EACH ROW EXECUTE FUNCTION public.contractor_services_lock_status_on_update();

-- 2) Reset all currently-approved services to 'pending' so each service goes through
--    the per-service admin approval flow the user requested.
UPDATE public.contractor_services
   SET status = 'pending',
       approved_at = NULL,
       approved_by = NULL,
       rejection_reason = NULL,
       updated_at = now()
 WHERE status = 'approved';
