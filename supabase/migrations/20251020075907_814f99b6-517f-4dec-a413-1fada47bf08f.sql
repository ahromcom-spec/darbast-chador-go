-- ایجاد trigger برای ایجاد رکوردهای تایید اولیه
CREATE TRIGGER create_approvals_on_new_order
  BEFORE INSERT ON public.projects_v3
  FOR EACH ROW
  EXECUTE FUNCTION public.create_initial_approvals();

-- ایجاد trigger برای اطلاع‌رسانی سفارش جدید
CREATE TRIGGER notify_on_new_order
  AFTER INSERT ON public.projects_v3
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_order();

-- ایجاد trigger برای اطلاع‌رسانی تغییرات سفارش
CREATE TRIGGER notify_on_order_update
  AFTER UPDATE ON public.projects_v3
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_order();

-- ایجاد trigger برای مدیریت workflow تایید سفارش
CREATE TRIGGER handle_order_workflow
  AFTER UPDATE ON public.projects_v3
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_order_approval_workflow();

-- ایجاد trigger برای بررسی تکمیل تاییدها
CREATE TRIGGER check_approvals_complete
  AFTER UPDATE ON public.order_approvals
  FOR EACH ROW
  EXECUTE FUNCTION public.check_all_approvals();

-- ایجاد trigger برای مدیریت تاییدیه‌ها
CREATE TRIGGER handle_approval_on_order
  AFTER INSERT OR UPDATE ON public.projects_v3
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_order_approval();