-- Enable realtime for daily_reports table to sync General module
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_reports;