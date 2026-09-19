CREATE TABLE IF NOT EXISTS public.media_compression_jobs (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'bale',
  source_url text not null,
  source_bucket text,
  source_path text,
  phone text,
  chat_id text,
  text_body text,
  order_id uuid,
  order_code text,
  kind text not null default 'video',
  status text not null default 'pending',
  attempts integer not null default 0,
  source_size bigint,
  output_size bigint,
  output_bucket text,
  output_path text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS media_compression_jobs_status_idx ON public.media_compression_jobs(status, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_compression_jobs TO authenticated;
GRANT ALL ON public.media_compression_jobs TO service_role;

ALTER TABLE public.media_compression_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Managers manage compression jobs" ON public.media_compression_jobs;
CREATE POLICY "Managers manage compression jobs"
ON public.media_compression_jobs FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'ceo') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'support_manager'))
WITH CHECK (public.has_role(auth.uid(), 'ceo') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'support_manager'));

CREATE TRIGGER media_compression_jobs_updated_at
BEFORE UPDATE ON public.media_compression_jobs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();