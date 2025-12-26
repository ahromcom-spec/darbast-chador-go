-- جدول جدید برای ذخیره تاریخچه گزارش‌های روزانه هر سفارش
CREATE TABLE public.order_daily_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.projects_v3(id) ON DELETE CASCADE,
  report_date DATE NOT NULL,
  activity_description TEXT,
  team_name TEXT,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ایجاد ایندکس برای جستجوی سریع
CREATE INDEX idx_order_daily_logs_order_id ON public.order_daily_logs(order_id);
CREATE INDEX idx_order_daily_logs_report_date ON public.order_daily_logs(report_date);

-- ایجاد ایندکس یکتا برای جلوگیری از تکرار گزارش در یک روز
CREATE UNIQUE INDEX idx_order_daily_logs_unique ON public.order_daily_logs(order_id, report_date);

-- فعال‌سازی RLS
ALTER TABLE public.order_daily_logs ENABLE ROW LEVEL SECURITY;

-- سیاست‌های دسترسی
CREATE POLICY "Everyone can view order daily logs"
ON public.order_daily_logs
FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can insert order daily logs"
ON public.order_daily_logs
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update order daily logs"
ON public.order_daily_logs
FOR UPDATE
USING (auth.uid() IS NOT NULL);

-- تریگر برای به‌روزرسانی updated_at
CREATE TRIGGER update_order_daily_logs_updated_at
BEFORE UPDATE ON public.order_daily_logs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();