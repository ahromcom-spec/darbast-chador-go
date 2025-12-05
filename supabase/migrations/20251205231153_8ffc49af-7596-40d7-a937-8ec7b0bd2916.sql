-- Add audio_path column to order_messages table
ALTER TABLE public.order_messages 
ADD COLUMN IF NOT EXISTS audio_path TEXT;

-- Create storage bucket for voice messages
INSERT INTO storage.buckets (id, name, public)
VALUES ('voice-messages', 'voice-messages', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for voice messages bucket
CREATE POLICY "Users can upload voice messages"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'voice-messages' AND
  auth.uid() IS NOT NULL
);

CREATE POLICY "Users can view voice messages for their orders"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'voice-messages' AND
  auth.uid() IS NOT NULL
);

CREATE POLICY "Users can delete their own voice messages"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'voice-messages' AND
  auth.uid() = owner
);