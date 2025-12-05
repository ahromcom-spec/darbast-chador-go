-- Make voice-messages bucket public for better playback compatibility
UPDATE storage.buckets SET public = true WHERE id = 'voice-messages';

-- Add public read policy if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage' 
    AND policyname = 'Public voice messages access'
  ) THEN
    CREATE POLICY "Public voice messages access"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'voice-messages');
  END IF;
END $$;