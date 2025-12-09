-- Add INSERT policy for voice-messages bucket to allow authenticated users to upload voice messages
CREATE POLICY "Authenticated users can upload voice messages"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'voice-messages' AND auth.uid() IS NOT NULL);