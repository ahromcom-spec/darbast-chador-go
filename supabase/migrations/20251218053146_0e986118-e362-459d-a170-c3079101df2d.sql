-- Enable realtime payloads for projects_v3 so archive/restore updates propagate instantly
ALTER TABLE public.projects_v3 REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication p
    JOIN pg_publication_rel pr ON p.oid = pr.prpubid
    JOIN pg_class c ON c.oid = pr.prrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE p.pubname = 'supabase_realtime'
      AND n.nspname = 'public'
      AND c.relname = 'projects_v3'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.projects_v3;
  END IF;
END $$;
