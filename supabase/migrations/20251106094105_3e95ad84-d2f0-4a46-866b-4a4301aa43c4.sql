-- ایجاد bucket برای تصاویر پیشرفت پروژه
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'executive-progress',
  'executive-progress',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
);

-- ایجاد جدول برای متادیتای تصاویر پیشرفت
CREATE TABLE IF NOT EXISTS project_progress_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects_v3(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  stage TEXT NOT NULL CHECK (stage IN ('ready', 'in_progress', 'completed')),
  storage_path TEXT NOT NULL,
  media_type TEXT DEFAULT 'image/jpeg',
  file_name TEXT NOT NULL,
  file_size INTEGER,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- فعال‌سازی RLS
ALTER TABLE project_progress_media ENABLE ROW LEVEL SECURITY;

-- Policy: مدیران اجرایی می‌توانند تصاویر را آپلود کنند
CREATE POLICY "Executive managers can insert progress media"
ON project_progress_media
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'scaffold_executive_manager'::app_role) 
  AND auth.uid() = uploaded_by
);

-- Policy: مدیران اجرایی می‌توانند تصاویر خودشان را ببینند
CREATE POLICY "Executive managers can view their progress media"
ON project_progress_media
FOR SELECT
USING (
  has_role(auth.uid(), 'scaffold_executive_manager'::app_role)
  AND auth.uid() = uploaded_by
);

-- Policy: مدیران اجرایی می‌توانند تصاویر خودشان را حذف کنند
CREATE POLICY "Executive managers can delete their progress media"
ON project_progress_media
FOR DELETE
USING (
  has_role(auth.uid(), 'scaffold_executive_manager'::app_role)
  AND auth.uid() = uploaded_by
);

-- Policy: ادمین، CEO و مدیر کل می‌توانند همه تصاویر را ببینند
CREATE POLICY "Admins can view all progress media"
ON project_progress_media
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'ceo'::app_role)
  OR has_role(auth.uid(), 'general_manager'::app_role)
);

-- Policy: مشتریان می‌توانند تصاویر پروژه‌های خودشان را ببینند
CREATE POLICY "Customers can view their project progress media"
ON project_progress_media
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM projects_v3 p
    JOIN customers c ON c.id = p.customer_id
    WHERE p.id = project_progress_media.project_id
      AND c.user_id = auth.uid()
  )
);

-- Storage Policies برای bucket
CREATE POLICY "Executive managers can upload to progress bucket"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'executive-progress'
  AND has_role(auth.uid(), 'scaffold_executive_manager'::app_role)
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Executive managers can view their uploads"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'executive-progress'
  AND (
    has_role(auth.uid(), 'scaffold_executive_manager'::app_role)
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
);

CREATE POLICY "Executive managers can delete their uploads"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'executive-progress'
  AND has_role(auth.uid(), 'scaffold_executive_manager'::app_role)
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Admins can view all progress uploads"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'executive-progress'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'ceo'::app_role)
    OR has_role(auth.uid(), 'general_manager'::app_role)
  )
);

CREATE POLICY "Customers can view their project progress uploads"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'executive-progress'
  AND EXISTS (
    SELECT 1
    FROM project_progress_media ppm
    JOIN projects_v3 p ON p.id = ppm.project_id
    JOIN customers c ON c.id = p.customer_id
    WHERE ppm.storage_path = storage.objects.name
      AND c.user_id = auth.uid()
  )
);

-- ایجاد اندیس برای بهبود عملکرد
CREATE INDEX idx_progress_media_project ON project_progress_media(project_id, stage);
CREATE INDEX idx_progress_media_uploader ON project_progress_media(uploaded_by);

-- Trigger برای به‌روزرسانی updated_at
CREATE TRIGGER update_progress_media_updated_at
  BEFORE UPDATE ON project_progress_media
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();