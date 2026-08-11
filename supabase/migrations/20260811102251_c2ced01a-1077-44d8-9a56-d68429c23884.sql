ALTER TABLE public.site_analytics
  ADD COLUMN IF NOT EXISTS details jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS is_impersonation boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS impersonator_user_id uuid;

ALTER TABLE public.site_sessions
  ADD COLUMN IF NOT EXISTS is_impersonation boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS impersonator_user_id uuid;

CREATE INDEX IF NOT EXISTS site_analytics_session_created_idx ON public.site_analytics (session_id, created_at);