-- Create storage bucket for order media
INSERT INTO storage.buckets (id, name, public) 
VALUES ('order-media', 'order-media', true)
ON CONFLICT (id) DO NOTHING;

-- Create table for order media metadata
CREATE TABLE IF NOT EXISTS public.project_media (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects_v3(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('image', 'video')),
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.project_media ENABLE ROW LEVEL SECURITY;

-- RLS Policies for project_media table
CREATE POLICY "Users can view own project media"
ON public.project_media
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM projects_v3 p
    JOIN customers c ON c.id = p.customer_id
    WHERE p.id = project_media.project_id
    AND c.user_id = auth.uid()
  )
);

CREATE POLICY "Users can upload media for own projects"
ON public.project_media
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM projects_v3 p
    JOIN customers c ON c.id = p.customer_id
    WHERE p.id = project_media.project_id
    AND c.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete own project media"
ON public.project_media
FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Staff can view all project media"
ON public.project_media
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'ceo'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role)
);

-- Storage policies for order-media bucket
CREATE POLICY "Users can upload media to own projects"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'order-media' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view own project media files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'order-media' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own project media files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'order-media' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Public can view order media"
ON storage.objects
FOR SELECT
USING (bucket_id = 'order-media');

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_project_media_project_id ON public.project_media(project_id);
CREATE INDEX IF NOT EXISTS idx_project_media_user_id ON public.project_media(user_id);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_project_media_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_project_media_updated_at
BEFORE UPDATE ON public.project_media
FOR EACH ROW
EXECUTE FUNCTION public.update_project_media_updated_at();