
-- پاک کردن trigger‌های تکراری
DROP TRIGGER IF EXISTS on_new_order ON public.projects_v3;
DROP TRIGGER IF EXISTS on_new_order_notify_ceo ON public.projects_v3;
DROP TRIGGER IF EXISTS on_order_approval ON public.projects_v3;
DROP TRIGGER IF EXISTS on_order_decision_notify_customer ON public.projects_v3;

-- نگه داشتن فقط trigger‌های اصلی
-- trg_notify_new_order و trg_handle_order_approval باقی می‌مانند
