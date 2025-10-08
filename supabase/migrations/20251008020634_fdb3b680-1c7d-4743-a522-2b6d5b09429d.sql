-- فاز 1 - مرحله 3b: فعال‌سازی RLS برای notifications

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies برای notifications
DROP POLICY IF EXISTS "User select own notifications" ON public.notifications;
DROP POLICY IF EXISTS "User update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "System insert notifications" ON public.notifications;

CREATE POLICY "User select own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "User update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "System insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true);