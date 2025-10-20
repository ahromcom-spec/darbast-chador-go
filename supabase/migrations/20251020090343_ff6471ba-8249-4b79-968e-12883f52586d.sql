-- Qualify column names to avoid ambiguous "id" errors in triggers
CREATE OR REPLACE FUNCTION public.notify_new_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  customer_name TEXT;
  customer_user_id UUID;
  subcategory_code TEXT;
BEGIN
  -- دریافت کد زیرمجموعه
  SELECT s.code INTO subcategory_code FROM public.subcategories AS s WHERE s.id = NEW.subcategory_id;
  
  -- فقط برای سفارش‌های داربست با اجناس (کد 01) و وضعیت pending
  IF NEW.status = 'pending' AND (TG_OP = 'INSERT' OR OLD.status != 'pending') AND subcategory_code = '01' THEN
    SELECT c.user_id INTO customer_user_id
    FROM public.customers AS c
    WHERE c.id = NEW.customer_id;
    
    SELECT p.full_name INTO customer_name
    FROM public.profiles AS p
    JOIN public.customers AS c ON c.user_id = p.user_id
    WHERE c.id = NEW.customer_id;
    
    -- ارسال نوتیفیکیشن به CEO (مدیرعامل)
    PERFORM public.notify_role(
      'ceo'::app_role,
      'سفارش جدید در انتظار تایید',
      COALESCE(customer_name, 'مشتری') || ' یک سفارش جدید ثبت کرده است. کد سفارش: ' || NEW.code,
      '/ceo/orders',
      'info'
    );
    
    -- ارسال نوتیفیکیشن به مدیر اجرایی
    PERFORM public.notify_role(
      'scaffold_executive_manager'::app_role,
      'سفارش جدید در انتظار تایید',
      COALESCE(customer_name, 'مشتری') || ' یک سفارش جدید ثبت کرده است. کد سفارش: ' || NEW.code,
      '/executive/orders',
      'info'
    );
    
    -- Log audit
    IF customer_user_id IS NOT NULL AND TG_OP = 'INSERT' THEN
      PERFORM public.log_audit(
        customer_user_id,
        'create_order',
        'projects_v3',
        NEW.id,
        jsonb_build_object('code', NEW.code, 'status', NEW.status)
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Ensure fully qualified columns in approvals aggregator
CREATE OR REPLACE FUNCTION public.check_all_approvals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    -- تغییر وضعیت به approved
    UPDATE public.projects_v3 AS p
    SET status = 'approved', approved_at = now()
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
        'سفارش تایید شد ✅',
        'سفارش شما با کد ' || order_code || ' توسط تمام مدیران تایید شد و در انتظار اجرا است.',
        '/user/projects',
        'success'
      );
    END IF;
    
    -- ارسال نوتیفیکیشن به مدیر اجرایی
    PERFORM public.notify_role(
      'scaffold_executive_manager'::app_role,
      'سفارش جدید برای اجرا',
      'سفارش با کد ' || order_code || ' آماده اجراست.',
      '/executive/orders',
      'info'
    );
  END IF;
  
  RETURN NEW;
END;
$function$;