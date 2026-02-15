-- Change FK on daily_report_order_id from CASCADE to SET NULL
-- so media records survive when order rows are deleted & re-inserted during save
ALTER TABLE public.daily_report_order_media
  DROP CONSTRAINT daily_report_order_media_daily_report_order_id_fkey;

ALTER TABLE public.daily_report_order_media
  ADD CONSTRAINT daily_report_order_media_daily_report_order_id_fkey
  FOREIGN KEY (daily_report_order_id) REFERENCES public.daily_report_orders(id)
  ON DELETE SET NULL;