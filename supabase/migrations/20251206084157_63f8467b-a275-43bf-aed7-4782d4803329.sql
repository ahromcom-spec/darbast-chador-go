-- Drop the broken INSERT policy
DROP POLICY IF EXISTS "Users can upload voice messages" ON storage.objects;

-- Create proper INSERT policy for voice messages
CREATE POLICY "Users can upload voice messages"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'voice-messages' AND auth.uid() IS NOT NULL);