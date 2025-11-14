-- حذف تریگر تکراری که باعث ارسال دو اعلان برای مدیر اجرایی می‌شود
-- فقط یک تریگر برای اعلان سفارش جدید کافی است

DROP TRIGGER IF EXISTS trg_notify_new_order ON public.projects_v3;