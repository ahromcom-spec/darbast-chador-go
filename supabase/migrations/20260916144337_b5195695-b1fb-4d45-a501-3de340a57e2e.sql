ALTER TABLE public.help_videos
  ADD COLUMN IF NOT EXISTS pos_x_mobile numeric,
  ADD COLUMN IF NOT EXISTS pos_y_mobile numeric,
  ADD COLUMN IF NOT EXISTS box_size_mobile integer;