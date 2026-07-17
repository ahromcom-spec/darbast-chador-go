
-- 1) New columns for per-service exit workflow
ALTER TABLE public.contractor_services
  ADD COLUMN IF NOT EXISTS exit_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS exit_request_reason text,
  ADD COLUMN IF NOT EXISTS exit_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS exit_approved_by uuid;

-- 2) Allow 'exited' as a valid status
ALTER TABLE public.contractor_services
  DROP CONSTRAINT IF EXISTS contractor_services_status_check;
ALTER TABLE public.contractor_services
  ADD CONSTRAINT contractor_services_status_check
  CHECK (status IN ('pending','approved','rejected','exited'));

-- 3) Extend UPDATE lock trigger so contractors cannot self-approve their own exit,
--    but ARE allowed to set/clear exit_requested_at & exit_request_reason on their own approved services.
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
    -- lock approval-related fields
    NEW.status := OLD.status;
    NEW.approved_by := OLD.approved_by;
    NEW.approved_at := OLD.approved_at;
    NEW.rejection_reason := OLD.rejection_reason;
    -- lock exit-approval fields (contractor cannot self-approve exit)
    NEW.exit_approved_at := OLD.exit_approved_at;
    NEW.exit_approved_by := OLD.exit_approved_by;
  END IF;
  RETURN NEW;
END; $$;

-- 4) RPC: contractor requests exit from one of their approved services
CREATE OR REPLACE FUNCTION public.request_contractor_service_exit(
  _service_id uuid,
  _reason text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_status text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;

  SELECT c.user_id, s.status
    INTO v_owner, v_status
    FROM public.contractor_services s
    JOIN public.contractors c ON c.id = s.contractor_id
   WHERE s.id = _service_id;

  IF v_owner IS NULL THEN RAISE EXCEPTION 'service not found'; END IF;
  IF v_owner <> v_uid THEN RAISE EXCEPTION 'permission denied'; END IF;
  IF v_status <> 'approved' THEN
    RAISE EXCEPTION 'only approved services can request exit';
  END IF;

  UPDATE public.contractor_services
     SET exit_requested_at = now(),
         exit_request_reason = _reason,
         updated_at = now()
   WHERE id = _service_id;
END; $$;

-- 5) RPC: contractor cancels their own pending exit request
CREATE OR REPLACE FUNCTION public.cancel_contractor_service_exit(
  _service_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_owner uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;

  SELECT c.user_id INTO v_owner
    FROM public.contractor_services s
    JOIN public.contractors c ON c.id = s.contractor_id
   WHERE s.id = _service_id;

  IF v_owner IS NULL THEN RAISE EXCEPTION 'service not found'; END IF;
  IF v_owner <> v_uid THEN RAISE EXCEPTION 'permission denied'; END IF;

  UPDATE public.contractor_services
     SET exit_requested_at = NULL,
         exit_request_reason = NULL,
         updated_at = now()
   WHERE id = _service_id
     AND exit_requested_at IS NOT NULL
     AND exit_approved_at IS NULL;
END; $$;

-- 6) RPC: admin approves per-service exit → status='exited'
CREATE OR REPLACE FUNCTION public.approve_contractor_service_exit(
  _service_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF NOT (
    public.has_role(v_uid, 'admin'::app_role)
    OR public.has_role(v_uid, 'ceo'::app_role)
    OR public.has_role(v_uid, 'general_manager'::app_role)
  ) THEN
    RAISE EXCEPTION 'permission denied';
  END IF;

  UPDATE public.contractor_services
     SET status = 'exited',
         exit_approved_at = now(),
         exit_approved_by = v_uid,
         updated_at = now()
   WHERE id = _service_id
     AND exit_requested_at IS NOT NULL;
END; $$;

-- 7) RPC: admin rejects per-service exit request → clears request, service stays approved
CREATE OR REPLACE FUNCTION public.reject_contractor_service_exit(
  _service_id uuid,
  _reason text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF NOT (
    public.has_role(v_uid, 'admin'::app_role)
    OR public.has_role(v_uid, 'ceo'::app_role)
    OR public.has_role(v_uid, 'general_manager'::app_role)
  ) THEN
    RAISE EXCEPTION 'permission denied';
  END IF;

  UPDATE public.contractor_services
     SET exit_requested_at = NULL,
         exit_request_reason = COALESCE(_reason, exit_request_reason),
         updated_at = now()
   WHERE id = _service_id
     AND exit_requested_at IS NOT NULL
     AND exit_approved_at IS NULL;
END; $$;

GRANT EXECUTE ON FUNCTION public.request_contractor_service_exit(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_contractor_service_exit(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_contractor_service_exit(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_contractor_service_exit(uuid, text) TO authenticated;
