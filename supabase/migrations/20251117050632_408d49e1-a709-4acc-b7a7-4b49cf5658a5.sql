-- Add public read access policy for project-media bucket
CREATE POLICY "Public read access to project-media"
ON storage.objects FOR SELECT
USING (bucket_id = 'project-media');