-- Replace order-automation edge function with secure database trigger
-- This eliminates the public endpoint vulnerability

CREATE OR REPLACE FUNCTION public.trigger_order_automation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  customer_user_id UUID;
  customer_name TEXT;
  customer_phone TEXT;
  province_name TEXT;
  subcategory_name TEXT;
  subcategory_code TEXT;
  ceo_managers RECORD;
BEGIN
  -- Only trigger for new pending orders or status changes to pending
  IF NEW.status = 'pending' AND (TG_OP = 'INSERT' OR OLD.status != 'pending') THEN
    
    -- Get subcategory code to check if this is scaffolding with materials (01)
    SELECT s.code INTO subcategory_code
    FROM subcategories s
    WHERE s.id = NEW.subcategory_id;
    
    -- Only process scaffolding with materials orders (code 01)
    IF subcategory_code != '01' THEN
      RETURN NEW;
    END IF;
    
    -- Get customer information
    SELECT c.user_id INTO customer_user_id
    FROM customers c
    WHERE c.id = NEW.customer_id;
    
    IF customer_user_id IS NOT NULL THEN
      -- Get customer profile details
      SELECT p.full_name, p.phone_number INTO customer_name, customer_phone
      FROM profiles p
      WHERE p.user_id = customer_user_id;
      
      -- Get province name
      SELECT pr.name INTO province_name
      FROM provinces pr
      WHERE pr.id = NEW.province_id;
      
      -- Get subcategory name
      SELECT s.name INTO subcategory_name
      FROM subcategories s
      WHERE s.id = NEW.subcategory_id;
      
      -- Send notifications to CEO and general managers
      FOR ceo_managers IN 
        SELECT DISTINCT ur.user_id
        FROM user_roles ur
        WHERE ur.role IN ('ceo', 'general_manager')
      LOOP
        PERFORM send_notification(
          ceo_managers.user_id,
          'سفارش جدید ' || NEW.code,
          'سفارش جدید از ' || COALESCE(customer_name, 'مشتری') || ' در ' || COALESCE(province_name, '') || ' ' || COALESCE(NEW.address, '') || ' ثبت شد و منتظر تأیید است.',
          '/ceo/orders',
          'info'
        );
      END LOOP;
      
      -- Send notification to customer
      PERFORM send_notification(
        customer_user_id,
        'سفارش ' || NEW.code || ' ثبت شد',
        'سفارش شما با کد ' || NEW.code || ' برای ' || COALESCE(subcategory_name, 'خدمات داربست') || ' با موفقیت ثبت شد و در حال بررسی توسط مدیریت است.',
        '/user/my-orders',
        'success'
      );
      
      -- Log audit trail
      PERFORM log_audit(
        customer_user_id,
        'automation_started',
        'projects_v3',
        NEW.id,
        jsonb_build_object(
          'order_code', NEW.code,
          'automation_type', 'order_workflow',
          'timestamp', now()
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trigger_order_automation_on_insert ON public.projects_v3;

-- Create new trigger for automated order processing
CREATE TRIGGER trigger_order_automation_on_insert
AFTER INSERT OR UPDATE ON public.projects_v3
FOR EACH ROW
EXECUTE FUNCTION public.trigger_order_automation();