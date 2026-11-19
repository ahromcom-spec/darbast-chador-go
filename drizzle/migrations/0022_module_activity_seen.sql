CREATE TABLE public.module_activity_seen (
  user_id uuid NOT NULL,
  module_key text NOT NULL,
  tab_key text NOT NULL,
  seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, module_key, tab_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.module_activity_seen TO authenticated;
GRANT ALL ON public.module_activity_seen TO service_role;

ALTER TABLE public.module_activity_seen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own module seen state" ON public.module_activity_seen
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own module seen state" ON public.module_activity_seen
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own module seen state" ON public.module_activity_seen
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own module seen state" ON public.module_activity_seen
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.mark_module_tab_seen(p_module_key text, p_tab_key text)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_seen timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF coalesce(length(p_module_key), 0) = 0 OR length(p_module_key) > 200
     OR coalesce(length(p_tab_key), 0) = 0 OR length(p_tab_key) > 100 THEN
    RAISE EXCEPTION 'invalid module or tab key';
  END IF;
  INSERT INTO public.module_activity_seen (user_id, module_key, tab_key, seen_at)
  VALUES (v_uid, p_module_key, p_tab_key, now())
  ON CONFLICT (user_id, module_key, tab_key) DO UPDATE SET seen_at = EXCLUDED.seen_at
  RETURNING seen_at INTO v_seen;
  RETURN v_seen;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_module_tab_seen(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_module_tab_seen(text, text) TO authenticated;