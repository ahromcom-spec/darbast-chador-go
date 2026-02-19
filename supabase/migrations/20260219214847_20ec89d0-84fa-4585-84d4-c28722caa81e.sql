-- حذف محدودیت یکتایی روی staff_code برای اجازه ثبت چندین بازه حقوق برای هر نیرو
ALTER TABLE public.staff_salary_settings DROP CONSTRAINT IF EXISTS unique_staff_code;