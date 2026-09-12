CREATE TABLE public.help_videos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  context_key text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  video_url text NOT NULL,
  storage_path text,
  poster_url text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.help_videos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.help_videos TO authenticated;
GRANT ALL ON public.help_videos TO service_role;

ALTER TABLE public.help_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active help videos"
ON public.help_videos FOR SELECT
USING (is_active = true OR public.has_role(auth.uid(), 'ceo') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'general_manager'));

CREATE POLICY "Managers can insert help videos"
ON public.help_videos FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'ceo') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'general_manager'));

CREATE POLICY "Managers can update help videos"
ON public.help_videos FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'ceo') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'general_manager'));

CREATE POLICY "Managers can delete help videos"
ON public.help_videos FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'ceo') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'general_manager'));

CREATE INDEX idx_help_videos_context_key ON public.help_videos (context_key);

CREATE TRIGGER update_help_videos_updated_at
BEFORE UPDATE ON public.help_videos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();