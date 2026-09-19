ALTER TABLE public.project_media
  ADD COLUMN IF NOT EXISTS media_date date;

UPDATE public.project_media
SET media_date = (created_at AT TIME ZONE 'Asia/Tehran')::date
WHERE media_date IS NULL;

ALTER TABLE public.project_media
  ALTER COLUMN media_date SET DEFAULT ((now() AT TIME ZONE 'Asia/Tehran')::date);

CREATE INDEX IF NOT EXISTS idx_project_media_media_date
  ON public.project_media (project_id, media_date DESC);