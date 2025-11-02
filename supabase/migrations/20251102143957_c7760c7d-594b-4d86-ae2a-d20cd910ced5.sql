-- افزایش حد مجاز آپلود فایل برای bucket order-media

UPDATE storage.buckets
SET 
  file_size_limit = 52428800,  -- 50MB در بایت
  allowed_mime_types = ARRAY[
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/webp',
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo',
    'video/avi'
  ]
WHERE id = 'order-media';