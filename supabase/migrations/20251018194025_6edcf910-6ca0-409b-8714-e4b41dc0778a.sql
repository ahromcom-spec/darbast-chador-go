
-- Fix handle_order_approval trigger to handle NULL customer_user_id
CREATE OR REPLACE FUNCTION public.handle_order_approval()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  customer_user_id UUID;
BEGIN
  IF OLD.status = 'pending' AND NEW.status IN ('approved', 'rejected') THEN
    SELECT user_id INTO customer_user_id
    FROM customers
    WHERE id = NEW.customer_id;
    
    -- بررسی کنیم که customer_user_id NULL نباشد
    IF customer_user_id IS NOT NULL THEN
      IF NEW.status = 'approved' THEN
        PERFORM send_notification(
          customer_user_id,
          'سفارش تایید شد ✅',
          'سفارش شما با کد ' || NEW.code || ' توسط مدیر تایید شد و به زودی اقدامات لازم انجام خواهد شد.',
          '/projects',
          'success'
        );
        
        PERFORM log_audit(
          NEW.approved_by,
          'approve_order',
          'projects_v3',
          NEW.id,
          jsonb_build_object('code', NEW.code, 'customer_id', NEW.customer_id)
        );
      ELSE
        PERFORM send_notification(
          customer_user_id,
          'سفارش رد شد ❌',
          'سفارش شما با کد ' || NEW.code || ' رد شد. دلیل: ' || COALESCE(NEW.rejection_reason, 'ذکر نشده'),
          '/projects',
          'error'
        );
        
        PERFORM log_audit(
          NEW.approved_by,
          'reject_order',
          'projects_v3',
          NEW.id,
          jsonb_build_object('code', NEW.code, 'customer_id', NEW.customer_id, 'reason', NEW.rejection_reason)
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Fix handle_order_approval_workflow trigger to handle NULL customer_user_id
CREATE OR REPLACE FUNCTION public.handle_order_approval_workflow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  customer_user_id UUID;
  order_code TEXT;
  subcategory_code TEXT;
BEGIN
  -- دریافت کد زیرمجموعه
  SELECT code INTO subcategory_code FROM subcategories WHERE id = NEW.subcategory_id;
  
  -- فقط برای سفارشات داربست با اجناس (کد 01)
  IF subcategory_code != '01' THEN
    RETURN NEW;
  END IF;

  SELECT user_id INTO customer_user_id FROM customers WHERE id = NEW.customer_id;
  order_code := NEW.code;

  -- بررسی کنیم که customer_user_id NULL نباشد
  IF customer_user_id IS NOT NULL THEN
    -- وقتی سفارش از pending به approved تغییر می‌کند
    IF OLD.status = 'pending' AND NEW.status = 'approved' THEN
      PERFORM send_notification(
        customer_user_id,
        'سفارش تایید شد ✅',
        'سفارش شما با کد ' || order_code || ' تایید شد و در انتظار اجراست.',
        '/user/orders',
        'success'
      );
      
      PERFORM notify_role(
        'scaffold_executive_manager'::app_role,
        'سفارش جدید برای اجرا',
        'سفارش با کد ' || order_code || ' آماده اجراست.',
        '/executive/orders',
        'info'
      );
    END IF;

    -- وقتی زمان اجرا ثبت می‌شود
    IF OLD.execution_start_date IS NULL AND NEW.execution_start_date IS NOT NULL THEN
      NEW.status := 'in_progress';
      
      PERFORM send_notification(
        customer_user_id,
        'زمان اجرا تعیین شد 📅',
        'زمان اجرای سفارش شما از تاریخ ' || TO_CHAR(NEW.execution_start_date, 'YYYY/MM/DD') || ' شروع می‌شود.',
        '/user/orders',
        'info'
      );
    END IF;

    -- وقتی اجرا تایید می‌شود
    IF OLD.status = 'in_progress' AND NEW.status = 'completed' THEN
      PERFORM send_notification(
        customer_user_id,
        'اجرای سفارش تکمیل شد ✅',
        'سفارش شما اجرا شده و در انتظار تسویه مالی است.',
        '/user/orders',
        'success'
      );
      
      PERFORM notify_role(
        'sales_manager'::app_role,
        'سفارش آماده تسویه',
        'سفارش با کد ' || order_code || ' اجرا شده و آماده تسویه مالی است.',
        '/sales/orders',
        'info'
      );
    END IF;

    -- وقتی پرداخت تایید می‌شود
    IF OLD.status = 'completed' AND NEW.status = 'paid' THEN
      PERFORM send_notification(
        customer_user_id,
        'پرداخت ثبت شد 💰',
        'پرداخت سفارش شما ثبت شد و در حال بررسی مالی است.',
        '/user/orders',
        'success'
      );
      
      PERFORM notify_role(
        'finance_manager'::app_role,
        'تراکنش جدید برای بررسی',
        'پرداخت سفارش با کد ' || order_code || ' باید بررسی و ثبت شود.',
        '/finance/transactions',
        'info'
      );
    END IF;

    -- وقتی مالی تایید می‌کند و پروژه بسته می‌شود
    IF OLD.status = 'paid' AND NEW.status = 'closed' THEN
      NEW.closed_at := NOW();
      
      PERFORM send_notification(
        customer_user_id,
        'سفارش به اتمام رسید ✅',
        'سفارش شما با موفقیت به اتمام رسید. از اعتماد شما سپاسگزاریم.',
        '/user/orders',
        'success'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
