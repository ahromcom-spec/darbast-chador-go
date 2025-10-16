
-- بهبود تابع notify_new_order برای جلوگیری از نوتیفیکیشن‌های تکراری
CREATE OR REPLACE FUNCTION public.notify_new_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  ceo_user_id UUID;
  customer_name TEXT;
  customer_user_id UUID;
  existing_notification_count INT;
BEGIN
  -- فقط برای سفارش‌های جدید با وضعیت pending
  IF NEW.status = 'pending' AND (TG_OP = 'INSERT' OR OLD.status != 'pending') THEN
    -- Get the actual user_id from customers table
    SELECT user_id INTO customer_user_id
    FROM customers
    WHERE id = NEW.customer_id;
    
    -- Get CEO user_id
    SELECT ur.user_id INTO ceo_user_id
    FROM user_roles ur
    WHERE ur.role = 'ceo'
    LIMIT 1;
    
    -- Get customer name
    SELECT p.full_name INTO customer_name
    FROM profiles p
    JOIN customers c ON c.user_id = p.user_id
    WHERE c.id = NEW.customer_id;
    
    -- بررسی اینکه آیا قبلاً برای این سفارش نوتیفیکیشن ارسال شده یا نه
    IF ceo_user_id IS NOT NULL THEN
      SELECT COUNT(*) INTO existing_notification_count
      FROM notifications
      WHERE user_id = ceo_user_id
        AND body LIKE '%' || NEW.code || '%'
        AND created_at > NOW() - INTERVAL '1 minute';
      
      -- فقط اگر نوتیفیکیشن قبلی وجود نداشته باشد، ارسال کن
      IF existing_notification_count = 0 THEN
        PERFORM send_notification(
          ceo_user_id,
          'سفارش جدید در انتظار تایید',
          COALESCE(customer_name, 'مشتری') || ' یک سفارش جدید ثبت کرده است. کد سفارش: ' || NEW.code,
          '/ceo/orders',
          'info'
        );
      END IF;
    END IF;
    
    -- Log audit (فقط یک بار)
    IF customer_user_id IS NOT NULL AND TG_OP = 'INSERT' THEN
      PERFORM log_audit(
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

-- پاک کردن نوتیفیکیشن‌های تکراری تست
DELETE FROM notifications 
WHERE id IN (
  SELECT id FROM notifications 
  WHERE user_id = '55edfafc-6890-4b71-8ddd-4426494bb275'
  AND body LIKE '%999/101010/50032481%'
  AND created_at > NOW() - INTERVAL '5 minutes'
  ORDER BY created_at DESC
  OFFSET 1
);

-- پاک کردن audit log‌های تکراری تست
DELETE FROM audit_log
WHERE id IN (
  SELECT id FROM audit_log
  WHERE entity_id = '96c05430-e066-4d5f-adf3-b813cb8cb243'
  ORDER BY created_at DESC
  OFFSET 1
);

-- پاک کردن سفارش تست
DELETE FROM projects_v3 WHERE code = '999/101010/50032481';
