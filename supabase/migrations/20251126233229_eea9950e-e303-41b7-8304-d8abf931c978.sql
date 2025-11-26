-- اضافه کردن RLS policy برای حذف رسانه‌های تایید نشده توسط کاربران

-- حذف policy قدیمی اگر وجود دارد
DROP POLICY IF EXISTS "Users can delete their unapproved order media" ON public.project_media;

-- ایجاد policy جدید: کاربران می‌توانند رسانه‌های سفارشات تایید نشده خود را حذف کنند
CREATE POLICY "Users can delete their unapproved order media"
  ON public.project_media
  FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.projects_v3 
      WHERE projects_v3.id = project_media.project_id 
      AND projects_v3.approved_at IS NULL
    )
  );