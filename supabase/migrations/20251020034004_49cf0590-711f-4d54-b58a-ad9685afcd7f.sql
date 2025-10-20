-- اضافه کردن فیلدهای جدید برای تایید اتمام پروژه
ALTER TABLE public.projects_v3
ADD COLUMN IF NOT EXISTS customer_completion_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS executive_completion_date TIMESTAMP WITH TIME ZONE;

-- به‌روزرسانی تابع گردش کار تایید سفارش
CREATE OR REPLACE FUNCTION public.handle_order_approval_workflow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

    -- وقتی زمان اجرا ثبت می‌شود (تنها فیلد execution_start_date پر شود)
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

    -- وقتی اجرا تایید می‌شود (مدیر اجرایی تایید کرد که کار انجام شد)
    IF OLD.status = 'in_progress' AND NEW.status = 'completed' THEN
      PERFORM send_notification(
        customer_user_id,
        'اجرای سفارش تکمیل شد ✅',
        'سفارش شما اجرا شده و در انتظار پرداخت و تسویه مالی است.',
        '/user/orders',
        'success'
      );
      
      -- اعلان به مدیر فروش
      PERFORM notify_role(
        'sales_manager'::app_role,
        'سفارش آماده تسویه',
        'سفارش با کد ' || order_code || ' اجرا شده و آماده دریافت پرداخت است.',
        '/sales/orders',
        'info'
      );
    END IF;

    -- وقتی پرداخت ثبت می‌شود (مدیر فروش پرداخت را ثبت کرد)
    IF OLD.status = 'completed' AND NEW.status = 'paid' THEN
      PERFORM send_notification(
        customer_user_id,
        'پرداخت ثبت شد 💰',
        'پرداخت سفارش شما ثبت شد. جهت تایید نهایی اتمام پروژه، تاریخ اتمام را اعلام کنید.',
        '/user/orders',
        'success'
      );
      
      -- اعلان به مدیر مالی
      PERFORM notify_role(
        'finance_manager'::app_role,
        'تراکنش جدید برای بررسی',
        'پرداخت سفارش با کد ' || order_code || ' ثبت شده و در انتظار تایید مالی است.',
        '/finance/transactions',
        'info'
      );
    END IF;

    -- وقتی هر دو (مشتری و اجرایی) تاریخ اتمام را ثبت کردند
    IF OLD.status = 'paid' AND NEW.customer_completion_date IS NOT NULL 
       AND NEW.executive_completion_date IS NOT NULL THEN
      NEW.status := 'closed';
      NEW.closed_at := NOW();
      
      PERFORM send_notification(
        customer_user_id,
        'سفارش به اتمام رسید ✅',
        'سفارش شما با موفقیت به اتمام رسید. از اعتماد شما سپاسگزاریم.',
        '/user/orders',
        'success'
      );
      
      -- اعلان به مدیر اجرایی
      PERFORM notify_role(
        'scaffold_executive_manager'::app_role,
        'پروژه به اتمام رسید',
        'سفارش با کد ' || order_code || ' با موفقیت به اتمام رسید.',
        '/executive/orders',
        'success'
      );
      
      -- اعلان به مدیرعامل
      PERFORM notify_role(
        'ceo'::app_role,
        'پروژه به اتمام رسید',
        'سفارش با کد ' || order_code || ' با موفقیت به اتمام رسید.',
        '/ceo/orders',
        'success'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;