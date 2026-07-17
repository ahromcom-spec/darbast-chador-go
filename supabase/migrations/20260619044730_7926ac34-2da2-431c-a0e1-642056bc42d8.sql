
CREATE TABLE IF NOT EXISTS public.assistant_chat_usage (
  id BIGSERIAL PRIMARY KEY,
  identifier TEXT NOT NULL,
  user_id UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS assistant_chat_usage_identifier_created_at_idx
  ON public.assistant_chat_usage (identifier, created_at DESC);
GRANT ALL ON public.assistant_chat_usage TO service_role;
ALTER TABLE public.assistant_chat_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role only" ON public.assistant_chat_usage FOR ALL TO service_role USING (true) WITH CHECK (true);
