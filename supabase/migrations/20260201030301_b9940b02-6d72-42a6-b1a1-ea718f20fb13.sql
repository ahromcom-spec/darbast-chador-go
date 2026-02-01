-- حذف constraint های محدودکننده
ALTER TABLE public.daily_reports DROP CONSTRAINT IF EXISTS daily_reports_report_date_unique;
ALTER TABLE public.daily_reports DROP CONSTRAINT IF EXISTS daily_reports_report_date_created_by_key;

-- ایجاد constraint جدید که ترکیب (report_date, created_by, module_key) را یکتا می‌کند
-- این اجازه می‌دهد که هر کاربر در هر ماژول یک گزارش در هر روز داشته باشد
CREATE UNIQUE INDEX IF NOT EXISTS daily_reports_date_user_module_unique 
ON public.daily_reports (report_date, created_by, COALESCE(module_key, 'default'));