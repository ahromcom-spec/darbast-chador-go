
-- Enable realtime for projects_v3 table
ALTER TABLE public.projects_v3 REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.projects_v3;
