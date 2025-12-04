-- Enable REPLICA IDENTITY FULL for better realtime support
ALTER TABLE public.voice_call_signals REPLICA IDENTITY FULL;

-- Ensure the table is in the realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'voice_call_signals'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.voice_call_signals;
  END IF;
END $$;