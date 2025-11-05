-- حذف تریگر و تابع تکراری initialize_order_approvals
-- این تابع با create_approval_records تداخل دارد و approvals تکراری می‌سازد

DROP TRIGGER IF EXISTS trigger_initialize_order_approvals ON public.projects_v3;
DROP FUNCTION IF EXISTS public.initialize_order_approvals();

-- حالا همه چیز از طریق تریگر create_approvals_on_order_submit کنترل می‌شود