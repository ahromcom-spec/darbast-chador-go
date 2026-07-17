ALTER TABLE public.staff_salary_settings REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_salary_settings;