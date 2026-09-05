ALTER TABLE public.project_media
  ADD COLUMN IF NOT EXISTS content_hash text,
  ADD COLUMN IF NOT EXISTS duration_seconds numeric;

ALTER TABLE public.daily_report_order_media
  ADD COLUMN IF NOT EXISTS content_hash text,
  ADD COLUMN IF NOT EXISTS duration_seconds numeric;

CREATE INDEX IF NOT EXISTS idx_drom_content_hash ON public.daily_report_order_media (content_hash);

CREATE UNIQUE INDEX IF NOT EXISTS uq_project_media_project_hash
  ON public.project_media (project_id, content_hash)
  WHERE content_hash IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_project_media_project_path
  ON public.project_media (project_id, file_path);