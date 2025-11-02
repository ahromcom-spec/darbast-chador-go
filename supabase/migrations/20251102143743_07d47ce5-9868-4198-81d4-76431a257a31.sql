-- اصلاح RLS policies برای آپلود ویدیو

-- حذف policy که با هم در تضاد است
DROP POLICY IF EXISTS "Public can view order media" ON storage.objects;

-- اصلاح policy برای آپلود فایل‌ها - اجازه آپلود برای همه کاربران احراز هویت شده
DROP POLICY IF EXISTS "Users can upload media to own projects" ON storage.objects;

CREATE POLICY "Authenticated users can upload to order-media"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'order-media' AND
  auth.uid() IS NOT NULL
);

-- اصلاح policy برای مشاهده فایل‌ها - اجازه مشاهده عمومی
CREATE POLICY "Anyone can view order media files"
ON storage.objects
FOR SELECT
USING (bucket_id = 'order-media');

-- اصلاح policy برای حذف فایل‌ها - فقط سازنده
DROP POLICY IF EXISTS "Users can delete own project media files" ON storage.objects;

CREATE POLICY "Users can delete own order media files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'order-media' AND
  auth.uid()::text = (storage.foldername(name))[1]
);