-- حذف trigger قبلی که مشکل ایجاد می‌کند
DROP TRIGGER IF EXISTS create_approvals_on_new_order ON public.projects_v3;

-- ایجاد مجدد trigger با AFTER INSERT به جای BEFORE INSERT
-- این باعث می‌شود که trigger بعد از insert اجرا شود و تداخلی با کد ایجاد نکند
CREATE TRIGGER create_approvals_on_new_order
  AFTER INSERT ON public.projects_v3
  FOR EACH ROW
  EXECUTE FUNCTION public.create_initial_approvals();