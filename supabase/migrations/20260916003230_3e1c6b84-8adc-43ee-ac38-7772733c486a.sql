ALTER TABLE public.help_videos
  ADD COLUMN IF NOT EXISTS placement text NOT NULL DEFAULT 'anchor',
  ADD COLUMN IF NOT EXISTS page_route text,
  ADD COLUMN IF NOT EXISTS pos_x numeric,
  ADD COLUMN IF NOT EXISTS pos_y numeric,
  ADD COLUMN IF NOT EXISTS box_size integer NOT NULL DEFAULT 56;

ALTER TABLE public.help_videos
  ADD CONSTRAINT help_videos_placement_check CHECK (placement IN ('anchor','floating'));