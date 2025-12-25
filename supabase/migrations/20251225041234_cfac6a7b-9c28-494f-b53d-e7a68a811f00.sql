-- Make order-media bucket publicly readable so existing UI public URLs work
UPDATE storage.buckets
SET public = true,
    file_size_limit = COALESCE(file_size_limit, 52428800),
    allowed_mime_types = COALESCE(allowed_mime_types, ARRAY['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime'])
WHERE id = 'order-media';