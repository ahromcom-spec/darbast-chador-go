-- اضافه کردن شماره مدیرعامل به whitelist
INSERT INTO public.phone_whitelist (phone_number, allowed_roles, notes, added_by)
VALUES ('09125511494', ARRAY['ceo'], 'مدیرعامل', NULL)
ON CONFLICT (phone_number) DO UPDATE 
SET allowed_roles = EXCLUDED.allowed_roles,
    notes = EXCLUDED.notes,
    updated_at = now();

-- تابع برای ارسال نوتیفیکیشن به مدیرعامل و مدیر اجرایی وقتی سفارش جدید ثبت می‌شود
CREATE OR REPLACE FUNCTION notify_managers_on_new_order()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- حذف trigger قبلی اگر وجود داشت
DROP TRIGGER IF EXISTS on_new_order_notify_managers ON public.projects_v3;

-- ایجاد trigger برای ارسال نوتیفیکیشن
CREATE TRIGGER on_new_order_notify_managers
  AFTER INSERT ON public.projects_v3
  FOR EACH ROW
  EXECUTE FUNCTION notify_managers_on_new_order();