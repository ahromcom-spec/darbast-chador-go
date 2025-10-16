-- Fix audit_log foreign key constraint violation in notify_new_order trigger
-- The issue is that we're passing customer_id instead of the actual user_id

CREATE OR REPLACE FUNCTION public.notify_new_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  ceo_user_id UUID;
  customer_name TEXT;
  customer_user_id UUID;
BEGIN
  IF NEW.status = 'pending' THEN
    -- Get the actual user_id from customers table
    SELECT user_id INTO customer_user_id
    FROM customers
    WHERE id = NEW.customer_id;
    
    SELECT ur.user_id INTO ceo_user_id
    FROM user_roles ur
    WHERE ur.role = 'ceo'
    LIMIT 1;
    
    SELECT p.full_name INTO customer_name
    FROM profiles p
    JOIN customers c ON c.user_id = p.user_id
    WHERE c.id = NEW.customer_id;
    
    IF ceo_user_id IS NOT NULL THEN
      PERFORM send_notification(
        ceo_user_id,
        'سفارش جدید در انتظار تایید',
        COALESCE(customer_name, 'مشتری') || ' یک سفارش جدید ثبت کرده است. کد سفارش: ' || NEW.code,
        '/ceo/orders',
        'info'
      );
    END IF;
    
    -- Use customer_user_id instead of customer_id
    IF customer_user_id IS NOT NULL THEN
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