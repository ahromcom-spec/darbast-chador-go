CREATE POLICY "Everyone can view active help video files"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'help-videos'
  AND EXISTS (
    SELECT 1
    FROM public.help_videos
    WHERE help_videos.storage_path = storage.objects.name
      AND help_videos.is_active = true
  )
);