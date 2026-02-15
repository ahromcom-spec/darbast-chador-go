
-- Table for storing media uploaded per daily report order row
CREATE TABLE public.daily_report_order_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_report_order_id UUID REFERENCES daily_report_orders(id) ON DELETE CASCADE,
  daily_report_id UUID NOT NULL REFERENCES daily_reports(id) ON DELETE CASCADE,
  order_id UUID REFERENCES projects_v3(id),
  user_id UUID NOT NULL,
  file_path TEXT NOT NULL,
  file_type VARCHAR(20) NOT NULL, -- 'image' or 'video'
  file_size INTEGER,
  mime_type VARCHAR(100),
  report_date DATE NOT NULL,
  synced_to_project_media BOOLEAN DEFAULT false,
  project_media_id UUID REFERENCES project_media(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.daily_report_order_media ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own report media"
ON public.daily_report_order_media
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own report media"
ON public.daily_report_order_media
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own report media"
ON public.daily_report_order_media
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own report media"
ON public.daily_report_order_media
FOR DELETE
USING (auth.uid() = user_id);

-- Index for fast lookup
CREATE INDEX idx_daily_report_order_media_report_id ON daily_report_order_media(daily_report_id);
CREATE INDEX idx_daily_report_order_media_order_id ON daily_report_order_media(order_id);
