-- Create order-media storage bucket if it doesn't exist
insert into storage.buckets (id, name, public)
select 'order-media', 'order-media', true
where not exists (select 1 from storage.buckets where id = 'order-media');

-- Drop existing policies if they exist (to recreate them)
DROP POLICY IF EXISTS "Public read access to order-media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload to order-media" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own order-media files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own order-media files" ON storage.objects;

-- Create policies
CREATE POLICY "Public read access to order-media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'order-media');

CREATE POLICY "Authenticated can upload to order-media"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'order-media' AND auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can update their own order-media files"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'order-media' AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own order-media files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'order-media' AND auth.uid()::text = (storage.foldername(name))[1]
  );