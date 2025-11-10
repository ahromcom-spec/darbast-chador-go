-- Update notify_order_status_change to link directly to order details page
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
      '/orders/' || NEW.id,
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
      '/orders/' || NEW.id,
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

-- Update notify_new_order to also send notification to customer with direct order link
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
  subcategory_name TEXT;
BEGIN
  -- دریافت کد زیرمجموعه
  SELECT s.code, s.name INTO subcategory_code, subcategory_name 
  FROM public.subcategories AS s 
  WHERE s.id = NEW.subcategory_id;
  
  -- فقط برای سفارش‌های داربست با اجناس (کد 10) و وضعیت pending
  IF NEW.status = 'pending' AND (TG_OP = 'INSERT' OR OLD.status != 'pending') AND subcategory_code = '10' THEN
    SELECT c.user_id INTO customer_user_id
    FROM public.customers AS c
    WHERE c.id = NEW.customer_id;
    
    SELECT p.full_name INTO customer_name
    FROM public.profiles AS p
    JOIN public.customers AS c ON c.user_id = p.user_id
    WHERE c.id = NEW.customer_id;
    
    -- ارسال نوتیفیکیشن به مشتری
    IF customer_user_id IS NOT NULL THEN
      PERFORM public.send_notification(
        customer_user_id,
        'سفارش ' || NEW.code || ' ثبت شد',
        'سفارش شما با کد ' || NEW.code || ' برای ' || COALESCE(subcategory_name, 'خدمات اجراء داربست به همراه اجناس داربست و حمل و نقل') || ' با موفقیت ثبت شد و در حال بررسی توسط مدیریت است.',
        '/orders/' || NEW.id,
        'success'
      );
    END IF;
    
    -- ارسال نوتیفیکیشن به CEO (مدیرعامل)
    PERFORM public.notify_role(
      'ceo'::app_role,
      'سفارش جدید ' || NEW.code,
      'سفارش جدید از ' || COALESCE(customer_name, 'مشتری') || ' ثبت شد و منتظر تأیید است.',
      '/ceo/orders',
      'info'
    );
    
    -- ارسال نوتیفیکیشن به مدیر اجرایی
    PERFORM public.notify_role(
      'scaffold_executive_manager'::app_role,
      'سفارش جدید در انتظار تایید',
      COALESCE(customer_name, 'مشتری') || ' یک سفارش داربست با اجناس ثبت کرده است. کد سفارش: ' || NEW.code,
      '/executive/pending-orders',
      'info'
    );

    -- ارسال نوتیفیکیشن به مدیر فروش (هر دو نقش)
    PERFORM public.notify_role(
      'sales_manager'::app_role,
      'سفارش جدید در انتظار تایید فروش',
      'سفارش با کد ' || NEW.code || ' برای تایید فروش منتظر شماست.',
      '/sales/pending-orders',
      'info'
    );
    PERFORM public.notify_role(
      'sales_manager_scaffold_execution_with_materials'::app_role,
      'سفارش جدید در انتظار تایید فروش',
      COALESCE(customer_name, 'مشتری') || ' یک سفارش داربست با اجناس ثبت کرده است. کد سفارش: ' || NEW.code,
      '/sales/pending-orders',
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