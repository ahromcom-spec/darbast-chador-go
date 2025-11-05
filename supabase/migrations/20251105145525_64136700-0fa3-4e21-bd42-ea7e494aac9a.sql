-- به‌روزرسانی تابع check_all_approvals برای تغییر وضعیت به pending_execution
CREATE OR REPLACE FUNCTION public.check_all_approvals()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  pending_count INTEGER;
  customer_user_id UUID;
  order_code TEXT;
BEGIN
  -- شمارش تاییدات باقی‌مانده
  SELECT COUNT(*) INTO pending_count
  FROM public.order_approvals AS oa
  WHERE oa.order_id = NEW.order_id AND oa.approved_at IS NULL;
  
  -- اگر همه تایید کردند
  IF pending_count = 0 THEN
    -- تغییر وضعیت به pending_execution (در انتظار اجرا)
    UPDATE public.projects_v3 AS p
    SET status = 'pending_execution', approved_at = now()
    WHERE p.id = NEW.order_id AND p.status = 'pending';
    
    -- ارسال نوتیفیکیشن به مشتری
    SELECT c.user_id INTO customer_user_id
    FROM public.customers AS c
    JOIN public.projects_v3 AS p ON p.customer_id = c.id
    WHERE p.id = NEW.order_id;
    
    SELECT p2.code INTO order_code FROM public.projects_v3 AS p2 WHERE p2.id = NEW.order_id;
    
    IF customer_user_id IS NOT NULL THEN
      PERFORM public.send_notification(
        customer_user_id,
        'سفارش شما در انتظار اجرا است ✅',
        'سفارش شما با کد ' || order_code || ' توسط تمام مدیران تایید شد و اکنون در انتظار اجرای خدمات می‌باشد.',
        '/user/my-orders',
        'success'
      );
    END IF;
    
    -- ارسال نوتیفیکیشن به مدیر اجرایی
    PERFORM public.notify_role(
      'scaffold_executive_manager'::app_role,
      'سفارش جدید برای اجرا',
      'سفارش با کد ' || order_code || ' تایید شد و آماده برنامه‌ریزی اجراست.',
      '/executive/orders',
      'info'
    );
  END IF;
  
  RETURN NEW;
END;
$function$;