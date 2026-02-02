-- Enable realtime for daily report sub-tables so aggregated module can sync
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_report_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_report_staff;