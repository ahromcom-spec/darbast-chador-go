-- Fix SECURITY DEFINER functions to include search_path
-- This prevents schema injection attacks

-- Fix check_all_approvals_complete function
CREATE OR REPLACE FUNCTION public.check_all_approvals_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  total_approvals INTEGER;
  completed_approvals INTEGER;
  order_status project_status_v3;
BEGIN
  -- Only proceed if this approval was just completed
  IF NEW.approved_at IS NOT NULL AND (OLD.approved_at IS NULL OR OLD.approved_at != NEW.approved_at) THEN
    
    -- Get current order status
    SELECT status INTO order_status
    FROM projects_v3
    WHERE id = NEW.order_id;
    
    -- Only update if order is still pending
    IF order_status = 'pending' THEN
      -- Count total and completed approvals for this order
      SELECT 
        COUNT(*),
        COUNT(approved_at)
      INTO total_approvals, completed_approvals
      FROM order_approvals
      WHERE order_id = NEW.order_id;
      
      -- If all approvals are complete, update order status
      IF completed_approvals = total_approvals THEN
        UPDATE projects_v3
        SET 
          status = 'in_progress',
          updated_at = NOW()
        WHERE id = NEW.order_id;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Fix notify_managers_on_new_order function
CREATE OR REPLACE FUNCTION public.notify_managers_on_new_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  ceo_user_id UUID;
  exec_manager_user_id UUID;
  customer_name TEXT;
  order_code TEXT;
BEGIN
  -- فقط برای سفارشات pending نوتیفیکیشن بفرست
  IF NEW.status = 'pending' AND OLD.status IS NULL THEN
    
    -- پیدا کردن user_id مدیرعامل
    SELECT p.user_id INTO ceo_user_id
    FROM profiles p
    WHERE p.phone_number = '09125511494'
    LIMIT 1;
    
    -- پیدا کردن user_id مدیر اجرایی
    SELECT p.user_id INTO exec_manager_user_id
    FROM profiles p
    WHERE p.phone_number = '09012121212'
    LIMIT 1;
    
    -- پیدا کردن نام مشتری
    SELECT p.full_name INTO customer_name
    FROM customers c
    JOIN profiles p ON p.user_id = c.user_id
    WHERE c.id = NEW.customer_id
    LIMIT 1;
    
    order_code := NEW.code;
    
    -- ارسال نوتیفیکیشن به مدیرعامل
    IF ceo_user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, body, type, link)
      VALUES (
        ceo_user_id,
        'سفارش جدید ثبت شد',
        'سفارش ' || order_code || ' توسط ' || COALESCE(customer_name, 'مشتری') || ' ثبت شد و منتظر تایید شماست.',
        'info',
        '/ceo/orders'
      );
    END IF;
    
    -- ارسال نوتیفیکیشن به مدیر اجرایی
    IF exec_manager_user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, body, type, link)
      VALUES (
        exec_manager_user_id,
        'سفارش جدید ثبت شد',
        'سفارش ' || order_code || ' توسط ' || COALESCE(customer_name, 'مشتری') || ' ثبت شد و منتظر تایید شماست.',
        'info',
        '/executive/pending-orders'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;