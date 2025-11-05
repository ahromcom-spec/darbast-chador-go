-- Create secure RPC to fetch sales manager pending orders
CREATE OR REPLACE FUNCTION public.get_sales_pending_orders()
RETURNS TABLE(
  id uuid,
  code text,
  address text,
  detailed_address text,
  created_at timestamp with time zone,
  notes jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only sales managers can call this
  IF NOT has_role(auth.uid(), 'sales_manager'::app_role) THEN
    RAISE EXCEPTION 'دسترسی غیرمجاز: فقط مدیر فروش';
  END IF;

  RETURN QUERY
  SELECT p.id, p.code, p.address, p.detailed_address, p.created_at, p.notes
  FROM projects_v3 p
  WHERE p.status = 'pending'
    AND EXISTS (
      SELECT 1 FROM order_approvals oa
      WHERE oa.order_id = p.id
        AND oa.approver_role IN ('sales_manager', 'sales_manager_scaffold_execution_with_materials')
        AND oa.approved_at IS NULL
    )
  ORDER BY p.created_at DESC;
END;
$$;

-- Create secure RPC to approve order as sales manager
CREATE OR REPLACE FUNCTION public.approve_order_as_sales_manager(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated INT;
BEGIN
  -- Only sales managers can approve
  IF NOT has_role(auth.uid(), 'sales_manager'::app_role) THEN
    RAISE EXCEPTION 'دسترسی غیرمجاز: فقط مدیر فروش';
  END IF;

  UPDATE order_approvals
  SET approver_user_id = auth.uid(), approved_at = now()
  WHERE order_id = _order_id
    AND approver_role IN ('sales_manager', 'sales_manager_scaffold_execution_with_materials')
    AND approved_at IS NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RAISE EXCEPTION 'هیچ تایید در انتظار برای مدیر فروش یافت نشد';
  END IF;

  PERFORM log_audit(auth.uid(), 'sales_approval', 'order_approvals', _order_id,
    jsonb_build_object('role', 'sales_manager'));
END;
$$;

-- Fix subcategory code checks from '01' to '10' and add sales_manager notifications
-- 1) trigger_order_automation: change scaffold code check
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
    -- Get subcategory code to check if this is scaffolding with materials
    SELECT s.code INTO subcategory_code
    FROM subcategories s
    WHERE s.id = NEW.subcategory_id;

    -- Only process scaffolding with materials orders (code 10)
    IF subcategory_code != '10' THEN
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

      -- Notify sales managers as well
      PERFORM notify_role(
        'sales_manager'::app_role,
        'سفارش جدید در انتظار تایید فروش',
        'سفارش با کد ' || NEW.code || ' برای تایید فروش منتظر شماست.',
        '/sales/pending-orders',
        'info'
      );

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

-- 2) handle_order_approval_workflow: fix scaffold code check and keep behavior
CREATE OR REPLACE FUNCTION public.handle_order_approval_workflow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  customer_user_id UUID;
  order_code TEXT;
  subcategory_code TEXT;
BEGIN
  -- دریافت کد زیرمجموعه
  SELECT code INTO subcategory_code FROM subcategories WHERE id = NEW.subcategory_id;
  
  -- فقط برای سفارشات داربست با اجناس (کد 10)
  IF subcategory_code != '10' THEN
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
  END IF;
  
  RETURN NEW;
END;
$$;

-- 3) notify_new_order: fix code check and add sales_manager notification
CREATE OR REPLACE FUNCTION public.notify_new_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  customer_name TEXT;
  customer_user_id UUID;
  subcategory_code TEXT;
BEGIN
  -- دریافت کد زیرمجموعه
  SELECT s.code INTO subcategory_code FROM public.subcategories AS s WHERE s.id = NEW.subcategory_id;
  
  -- فقط برای سفارش‌های داربست با اجناس (کد 10) و وضعیت pending
  IF NEW.status = 'pending' AND (TG_OP = 'INSERT' OR OLD.status != 'pending') AND subcategory_code = '10' THEN
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

    -- ارسال نوتیفیکیشن به مدیر فروش
    PERFORM public.notify_role(
      'sales_manager'::app_role,
      'سفارش جدید در انتظار تایید فروش',
      COALESCE(customer_name, 'مشتری') || ' یک سفارش جدید ثبت کرده است. کد سفارش: ' || NEW.code,
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
$$;