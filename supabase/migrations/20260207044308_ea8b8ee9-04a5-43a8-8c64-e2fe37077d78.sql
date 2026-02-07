-- ایندکس یکتا برای جلوگیری از تکثیر ردیف‌ها در daily_report_orders
-- یک سفارش می‌تواند چندین بار در یک گزارش باشد (مثلا برای فعالیت‌های مختلف)
-- پس نمی‌توانیم unique بر اساس (daily_report_id, order_id) بگذاریم
-- اما می‌توانیم با استفاده از روش delete-then-insert با guard های code-level از تکثیر جلوگیری کنیم

-- اضافه کردن ایندکس برای بهبود عملکرد حذف
CREATE INDEX IF NOT EXISTS idx_daily_report_orders_report_id ON daily_report_orders(daily_report_id);

-- اضافه کردن ایندکس برای بهبود عملکرد حذف در daily_report_staff
CREATE INDEX IF NOT EXISTS idx_daily_report_staff_report_id ON daily_report_staff(daily_report_id);