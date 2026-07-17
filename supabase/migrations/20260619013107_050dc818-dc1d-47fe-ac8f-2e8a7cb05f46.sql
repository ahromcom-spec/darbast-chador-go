
ALTER TABLE public.cheques ADD COLUMN IF NOT EXISTS image_url text;

DO $$ BEGIN
  CREATE POLICY "Public can view cheque images"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'cheque-images');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated can upload cheque images"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'cheque-images' AND auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated can update cheque images"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'cheque-images' AND auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated can delete cheque images"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'cheque-images' AND auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
