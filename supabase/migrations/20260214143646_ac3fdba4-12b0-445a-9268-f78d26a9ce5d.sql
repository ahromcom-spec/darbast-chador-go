
-- جدول قفل تثبیت تاریخ گزارش روزانه
-- وقتی مدیر کلی یک تاریخ را قفل می‌کند، ماژول‌های منبع نمی‌توانند آن تاریخ را ویرایش کنند
CREATE TABLE public.daily_report_date_locks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_date DATE NOT NULL,
  locked_by UUID NOT NULL,
  locked_by_module_key TEXT NOT NULL,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(report_date)
);

-- Enable RLS
ALTER TABLE public.daily_report_date_locks ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read locks (to check if a date is locked)
CREATE POLICY "Authenticated users can view date locks"
ON public.daily_report_date_locks
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Only the locker can insert/delete locks
CREATE POLICY "Authenticated users can create date locks"
ON public.daily_report_date_locks
FOR INSERT
WITH CHECK (auth.uid() = locked_by);

CREATE POLICY "Lock owner can delete date locks"
ON public.daily_report_date_locks
FOR DELETE
USING (auth.uid() = locked_by);

-- Enable realtime for instant lock status updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_report_date_locks;
