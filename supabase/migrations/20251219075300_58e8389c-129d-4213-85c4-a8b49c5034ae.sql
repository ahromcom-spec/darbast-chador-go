-- اصلاح تابع check_all_approvals برای پاک کردن execution_stage هنگام تایید
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
    -- تغییر وضعیت به pending_execution (در انتظار اجرا) و پاک کردن execution_stage
    UPDATE public.projects_v3 AS p
    SET 
      status = 'pending_execution', 
      approved_at = now(),
      execution_stage = NULL,
      execution_stage_updated_at = now(),
      updated_at = now()
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

-- اصلاح تابع check_and_update_order_status برای پاک کردن execution_stage هنگام تایید
CREATE OR REPLACE FUNCTION public.check_and_update_order_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pending_count integer;
  v_order_status project_status_v3;
  customer_user_id uuid;
  order_code text;
BEGIN
  IF NEW.approved_at IS NOT NULL AND (OLD.approved_at IS NULL OR OLD.approved_at != NEW.approved_at) THEN
    SELECT status, code INTO v_order_status, order_code
    FROM projects_v3
    WHERE id = NEW.order_id;

    IF v_order_status = 'pending' THEN
      SELECT COUNT(*) INTO v_pending_count
      FROM order_approvals
      WHERE order_id = NEW.order_id
        AND approved_at IS NULL;

      IF v_pending_count = 0 THEN
        UPDATE projects_v3
        SET
          status = 'pending_execution'::project_status_v3,
          approved_at = now(),
          execution_stage = NULL,
          execution_stage_updated_at = now(),
          updated_at = now()
        WHERE id = NEW.order_id;

        SELECT c.user_id INTO customer_user_id
        FROM customers c
        JOIN projects_v3 p ON p.customer_id = c.id
        WHERE p.id = NEW.order_id;

        IF customer_user_id IS NOT NULL THEN
          PERFORM send_notification(
            customer_user_id,
            'سفارش شما در انتظار اجرا است ✅',
            'سفارش شما با کد ' || order_code || ' توسط تمام مدیران تایید شد و اکنون در انتظار اجرای خدمات می‌باشد.',
            '/user/my-orders',
            'success'
          );
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;