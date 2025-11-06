-- Create function to notify customer on order status changes
CREATE OR REPLACE FUNCTION public.notify_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  customer_user_id UUID;
  order_code TEXT;
  notification_title TEXT;
  notification_body TEXT;
BEGIN
  -- Get customer user_id from customers table
  SELECT c.user_id INTO customer_user_id
  FROM public.customers c
  WHERE c.id = NEW.customer_id;
  
  IF customer_user_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  order_code := NEW.code;
  
  -- Notify when order status changes to in_progress
  IF OLD.status = 'approved' AND NEW.status = 'in_progress' THEN
    notification_title := 'سفارش شما در حال اجرا است 🚀';
    notification_body := 'سفارش شما با کد ' || order_code || ' توسط تیم اجرایی شروع شده است و در حال انجام می‌باشد.';
    
    PERFORM public.send_notification(
      customer_user_id,
      notification_title,
      notification_body,
      '/user/my-orders',
      'info'
    );
    
    PERFORM public.log_audit(
      NEW.approved_by,
      'start_order_execution',
      'projects_v3',
      NEW.id,
      jsonb_build_object('code', order_code, 'status', 'in_progress')
    );
  END IF;
  
  -- Notify when order status changes to completed
  IF OLD.status = 'in_progress' AND NEW.status = 'completed' THEN
    notification_title := 'خدمات شما اجرا شد ✅';
    notification_body := 'سفارش شما با کد ' || order_code || ' به پایان رسیده است. خدمات شما اجرا شده و در انتظار پرداخت می‌باشد.';
    
    PERFORM public.send_notification(
      customer_user_id,
      notification_title,
      notification_body,
      '/user/my-orders',
      'success'
    );
    
    PERFORM public.log_audit(
      NEW.approved_by,
      'complete_order_execution',
      'projects_v3',
      NEW.id,
      jsonb_build_object('code', order_code, 'status', 'completed')
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop trigger if exists and create new one
DROP TRIGGER IF EXISTS trigger_notify_order_status_change ON public.projects_v3;

CREATE TRIGGER trigger_notify_order_status_change
  AFTER UPDATE ON public.projects_v3
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.notify_order_status_change();