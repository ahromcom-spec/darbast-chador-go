-- Create table for voice call signaling
CREATE TABLE public.voice_call_signals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.projects_v3(id) ON DELETE CASCADE,
  caller_id UUID NOT NULL,
  receiver_id UUID NOT NULL,
  signal_type TEXT NOT NULL, -- 'offer', 'answer', 'ice-candidate', 'call-request', 'call-accept', 'call-reject', 'call-end'
  signal_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.voice_call_signals ENABLE ROW LEVEL SECURITY;

-- Users can read signals where they are caller or receiver
CREATE POLICY "Users can read their call signals"
ON public.voice_call_signals
FOR SELECT
USING (auth.uid() = caller_id OR auth.uid() = receiver_id);

-- Users can create call signals
CREATE POLICY "Users can create call signals"
ON public.voice_call_signals
FOR INSERT
WITH CHECK (auth.uid() = caller_id);

-- Users can delete their own signals
CREATE POLICY "Users can delete their call signals"
ON public.voice_call_signals
FOR DELETE
USING (auth.uid() = caller_id OR auth.uid() = receiver_id);

-- Enable realtime for voice call signals
ALTER PUBLICATION supabase_realtime ADD TABLE public.voice_call_signals;

-- Create index for faster queries
CREATE INDEX idx_voice_call_signals_order ON public.voice_call_signals(order_id);
CREATE INDEX idx_voice_call_signals_receiver ON public.voice_call_signals(receiver_id, created_at DESC);