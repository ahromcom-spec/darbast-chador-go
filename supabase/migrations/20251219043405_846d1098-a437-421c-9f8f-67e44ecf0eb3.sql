-- Set REPLICA IDENTITY FULL for complete row data in realtime updates
ALTER TABLE public.projects_v3 REPLICA IDENTITY FULL;