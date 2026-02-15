-- Update project-media bucket to allow more video MIME types
UPDATE storage.buckets 
SET allowed_mime_types = ARRAY[
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
  'video/mp4', 'video/quicktime', 'video/x-msvideo', 
  'video/webm', 'video/3gpp', 'video/3gpp2', 'video/x-matroska',
  'video/ogg', 'video/mpeg'
]
WHERE id = 'project-media';