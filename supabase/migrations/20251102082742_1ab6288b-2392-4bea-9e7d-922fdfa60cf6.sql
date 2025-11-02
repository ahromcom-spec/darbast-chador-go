-- Create storage bucket for project media
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'project-media',
  'project-media',
  false,
  52428800, -- 50MB max (for videos)
  ARRAY[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for project media
CREATE POLICY "Users can upload their own project media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'project-media' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own project media"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'project-media' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own project media"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'project-media' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Staff and admins can view all project media
CREATE POLICY "Staff can view all project media"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'project-media' AND
  (
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.has_role(auth.uid(), 'general_manager'::app_role) OR
    public.has_role(auth.uid(), 'ceo'::app_role) OR
    public.has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR
    public.has_role(auth.uid(), 'sales_manager'::app_role) OR
    public.has_role(auth.uid(), 'finance_manager'::app_role)
  )
);