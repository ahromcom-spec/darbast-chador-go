ALTER TABLE public.contractors
  ADD COLUMN IF NOT EXISTS deactivated_by_admin boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reactivation_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS reactivation_request_reason text;