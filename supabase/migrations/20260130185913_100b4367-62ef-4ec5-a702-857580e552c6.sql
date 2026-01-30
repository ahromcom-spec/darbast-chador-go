-- افزودن ستون is_company_expense به جدول daily_report_staff
-- برای تشخیص سطر ثابت «ماهیت شرکت اهرم» جهت ثبت هزینه‌های روزانه شرکت

ALTER TABLE public.daily_report_staff
ADD COLUMN IF NOT EXISTS is_company_expense BOOLEAN DEFAULT false;