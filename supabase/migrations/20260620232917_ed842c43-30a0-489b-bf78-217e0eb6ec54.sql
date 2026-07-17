
ALTER TABLE public.contractors 
  ADD COLUMN IF NOT EXISTS exit_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS exit_request_reason text,
  ADD COLUMN IF NOT EXISTS service_category_id uuid,
  ADD COLUMN IF NOT EXISTS activity_type_id uuid,
  ADD COLUMN IF NOT EXISTS region_id uuid;
