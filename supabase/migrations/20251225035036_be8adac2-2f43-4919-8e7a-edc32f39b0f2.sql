-- Create the order-media storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'order-media', 
  'order-media', 
  true,
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime']
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for order-media bucket
CREATE POLICY "Anyone can view order media" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'order-media');

CREATE POLICY "Authenticated users can upload order media" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'order-media' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their own order media" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'order-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own order media" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'order-media' AND auth.uid()::text = (storage.foldername(name))[1]);