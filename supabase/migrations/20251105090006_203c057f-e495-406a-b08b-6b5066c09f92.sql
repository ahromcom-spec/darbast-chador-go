-- Allow both sales_manager roles in RPCs and ensure approval creation + notifications

-- 1) Update get_sales_pending_orders to allow both roles
CREATE OR REPLACE FUNCTION public.get_sales_pending_orders()
RETURNS TABLE(id uuid, code text, address text, detailed_address text, created_at timestamp with time zone, notes jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Allow both general and specialized sales managers
  IF NOT (
    has_role(auth.uid(), 'sales_manager'::app_role) OR
    has_role(auth.uid(), 'sales_manager_scaffold_execution_with_materials'::app_role)
  ) THEN
    RAISE EXCEPTION 'دسترسی غیرمجاز: فقط مدیر فروش';
  END IF;

  RETURN QUERY
  SELECT p.id, p.code, p.address, p.detailed_address, p.created_at, p.notes
  FROM projects_v3 p
  WHERE p.status = 'pending'
    AND EXISTS (
      SELECT 1 FROM order_approvals oa
      WHERE oa.order_id = p.id
        AND oa.approver_role IN (
          'sales_manager',
          'sales_manager_scaffold_execution_with_materials'
        )
        AND oa.approved_at IS NULL
    )
  ORDER BY p.created_at DESC;
END;
$function$;

-- 2) Update approve_order_as_sales_manager to accept both roles
CREATE OR REPLACE FUNCTION public.approve_order_as_sales_manager(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_updated INT;
BEGIN
  -- Allow both general and specialized sales managers
  IF NOT (
    has_role(auth.uid(), 'sales_manager'::app_role) OR
    has_role(auth.uid(), 'sales_manager_scaffold_execution_with_materials'::app_role)
  ) THEN
    RAISE EXCEPTION 'دسترسی غیرمجاز: فقط مدیر فروش';
  END IF;

  UPDATE order_approvals
  SET approver_user_id = auth.uid(), approved_at = now()
  WHERE order_id = _order_id
    AND approver_role IN (
      'sales_manager',
      'sales_manager_scaffold_execution_with_materials'
    )
    AND approved_at IS NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RAISE EXCEPTION 'هیچ تایید در انتظار برای مدیر فروش یافت نشد';
  END IF;

  PERFORM log_audit(auth.uid(), 'sales_approval', 'order_approvals', _order_id,
    jsonb_build_object('role', 'sales_manager'));
END;
$function$;

-- 3) Ensure notifications go to specialized sales manager as well when new order is created (pending + scaffolding/materials)
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

    -- ارسال نوتیفیکیشن به مدیر فروش (هر دو نقش)
    PERFORM public.notify_role(
      'sales_manager'::app_role,
      'سفارش جدید در انتظار تایید فروش',
      COALESCE(customer_name, 'مشتری') || ' یک سفارش جدید ثبت کرده است. کد سفارش: ' || NEW.code,
      '/sales/pending-orders',
      'info'
    );
    PERFORM public.notify_role(
      'sales_manager_scaffold_execution_with_materials'::app_role,
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
$function$;

-- 4) Also update trigger_order_automation to notify both sales roles
CREATE OR REPLACE FUNCTION public.trigger_order_automation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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

      -- Notify sales managers (both roles)
      PERFORM notify_role(
        'sales_manager'::app_role,
        'سفارش جدید در انتظار تایید فروش',
        'سفارش با کد ' || NEW.code || ' برای تایید فروش منتظر شماست.',
        '/sales/pending-orders',
        'info'
      );
      PERFORM notify_role(
        'sales_manager_scaffold_execution_with_materials'::app_role,
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
$function$;

-- 5) Ensure approval records exist for scaffolding with materials orders (code 10)
CREATE OR REPLACE FUNCTION public.ensure_sales_materials_approvals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_code TEXT;
BEGIN
  SELECT s.code INTO v_code FROM public.subcategories s WHERE s.id = NEW.subcategory_id;
  IF v_code = '10' AND NEW.status = 'pending' THEN
    -- specialized role
    INSERT INTO public.order_approvals(order_id, approver_role, created_at)
    SELECT NEW.id, 'sales_manager_scaffold_execution_with_materials', now()
    WHERE NOT EXISTS (
      SELECT 1 FROM public.order_approvals WHERE order_id = NEW.id AND approver_role = 'sales_manager_scaffold_execution_with_materials'
    );

    -- general sales manager role
    INSERT INTO public.order_approvals(order_id, approver_role, created_at)
    SELECT NEW.id, 'sales_manager', now()
    WHERE NOT EXISTS (
      SELECT 1 FROM public.order_approvals WHERE order_id = NEW.id AND approver_role = 'sales_manager'
    );
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_ensure_sales_materials_approvals ON public.projects_v3;
CREATE TRIGGER trg_ensure_sales_materials_approvals
AFTER INSERT ON public.projects_v3
FOR EACH ROW
EXECUTE FUNCTION public.ensure_sales_materials_approvals();

-- 6) Backfill approvals for existing pending orders with subcategory code 10
INSERT INTO public.order_approvals(order_id, approver_role, created_at)
SELECT p.id, r.role, now()
FROM public.projects_v3 p
JOIN public.subcategories s ON s.id = p.subcategory_id
CROSS JOIN (VALUES ('sales_manager'), ('sales_manager_scaffold_execution_with_materials')) AS r(role)
LEFT JOIN public.order_approvals oa ON oa.order_id = p.id AND oa.approver_role = r.role
WHERE p.status = 'pending' AND s.code = '10' AND oa.id IS NULL;