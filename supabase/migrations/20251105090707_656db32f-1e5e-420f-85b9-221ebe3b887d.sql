-- Remove references to the non-existent sales_manager_scaffold_execution_with_materials role
-- Since the enum doesn't have this value, we'll only use sales_manager

-- 1) Update get_sales_pending_orders: only check sales_manager role
CREATE OR REPLACE FUNCTION public.get_sales_pending_orders()
RETURNS TABLE(id uuid, code text, address text, detailed_address text, created_at timestamp with time zone, notes jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Only sales_manager (the specialized role doesn't exist in enum)
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
        AND oa.approver_role = 'sales_manager'
        AND oa.approved_at IS NULL
    )
  ORDER BY p.created_at DESC;
END;
$function$;

-- 2) Update approve_order_as_sales_manager
CREATE OR REPLACE FUNCTION public.approve_order_as_sales_manager(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_updated INT;
BEGIN
  IF NOT has_role(auth.uid(), 'sales_manager'::app_role) THEN
    RAISE EXCEPTION 'دسترسی غیرمجاز: فقط مدیر فروش';
  END IF;

  UPDATE order_approvals
  SET approver_user_id = auth.uid(), approved_at = now()
  WHERE order_id = _order_id
    AND approver_role = 'sales_manager'
    AND approved_at IS NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RAISE EXCEPTION 'هیچ تایید در انتظار برای مدیر فروش یافت نشد';
  END IF;

  PERFORM log_audit(auth.uid(), 'sales_approval', 'order_approvals', _order_id,
    jsonb_build_object('role', 'sales_manager'));
END;
$function$;

-- 3) Update notify_new_order to only notify sales_manager
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
  SELECT s.code INTO subcategory_code FROM public.subcategories AS s WHERE s.id = NEW.subcategory_id;
  
  IF NEW.status = 'pending' AND (TG_OP = 'INSERT' OR OLD.status != 'pending') AND subcategory_code = '10' THEN
    SELECT c.user_id INTO customer_user_id
    FROM public.customers AS c
    WHERE c.id = NEW.customer_id;
    
    SELECT p.full_name INTO customer_name
    FROM public.profiles AS p
    JOIN public.customers AS c ON c.user_id = p.user_id
    WHERE c.id = NEW.customer_id;
    
    PERFORM public.notify_role(
      'ceo'::app_role,
      'سفارش جدید در انتظار تایید',
      COALESCE(customer_name, 'مشتری') || ' یک سفارش جدید ثبت کرده است. کد سفارش: ' || NEW.code,
      '/ceo/orders',
      'info'
    );
    
    PERFORM public.notify_role(
      'scaffold_executive_manager'::app_role,
      'سفارش جدید در انتظار تایید',
      COALESCE(customer_name, 'مشتری') || ' یک سفارش جدید ثبت کرده است. کد سفارش: ' || NEW.code,
      '/executive/orders',
      'info'
    );

    -- Only notify sales_manager (single role)
    PERFORM public.notify_role(
      'sales_manager'::app_role,
      'سفارش جدید در انتظار تایید فروش',
      COALESCE(customer_name, 'مشتری') || ' یک سفارش جدید ثبت کرده است. کد سفارش: ' || NEW.code,
      '/sales/pending-orders',
      'info'
    );
    
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

-- 4) Update trigger_order_automation
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
  IF NEW.status = 'pending' AND (TG_OP = 'INSERT' OR OLD.status != 'pending') THEN
    SELECT s.code INTO subcategory_code
    FROM subcategories s
    WHERE s.id = NEW.subcategory_id;

    IF subcategory_code != '10' THEN
      RETURN NEW;
    END IF;

    SELECT c.user_id INTO customer_user_id
    FROM customers c
    WHERE c.id = NEW.customer_id;

    IF customer_user_id IS NOT NULL THEN
      SELECT p.full_name, p.phone_number INTO customer_name, customer_phone
      FROM profiles p
      WHERE p.user_id = customer_user_id;

      SELECT pr.name INTO province_name
      FROM provinces pr
      WHERE pr.id = NEW.province_id;

      SELECT s.name INTO subcategory_name
      FROM subcategories s
      WHERE s.id = NEW.subcategory_id;

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

      -- Only notify sales_manager (single role)
      PERFORM notify_role(
        'sales_manager'::app_role,
        'سفارش جدید در انتظار تایید فروش',
        'سفارش با کد ' || NEW.code || ' برای تایید فروش منتظر شماست.',
        '/sales/pending-orders',
        'info'
      );

      PERFORM send_notification(
        customer_user_id,
        'سفارش ' || NEW.code || ' ثبت شد',
        'سفارش شما با کد ' || NEW.code || ' برای ' || COALESCE(subcategory_name, 'خدمات داربست') || ' با موفقیت ثبت شد و در حال بررسی توسط مدیریت است.',
        '/user/my-orders',
        'success'
      );

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

-- 5) Update ensure_sales_materials_approvals: only create sales_manager approvals
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
    INSERT INTO public.order_approvals(order_id, approver_role, created_at)
    SELECT NEW.id, 'sales_manager', now()
    WHERE NOT EXISTS (
      SELECT 1 FROM public.order_approvals WHERE order_id = NEW.id AND approver_role = 'sales_manager'
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- 6) Update projects_v3 RLS policies to use only sales_manager
DROP POLICY IF EXISTS "Sales can view pending awaiting their approval" ON public.projects_v3;
CREATE POLICY "Sales can view pending awaiting their approval"
ON public.projects_v3
FOR SELECT
USING (
  has_role(auth.uid(), 'sales_manager'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.order_approvals oa
    WHERE oa.order_id = projects_v3.id
      AND oa.approved_at IS NULL
      AND oa.approver_role = 'sales_manager'
  )
);

DROP POLICY IF EXISTS "Sales managers can edit pending orders" ON public.projects_v3;
CREATE POLICY "Sales managers can edit pending orders"
ON public.projects_v3
FOR UPDATE
USING (
  has_role(auth.uid(), 'sales_manager'::app_role)
  AND status = 'pending'
)
WITH CHECK (
  has_role(auth.uid(), 'sales_manager'::app_role)
  AND status IN ('pending','in_progress')
);

DROP POLICY IF EXISTS "Sales managers can update payment details" ON public.projects_v3;
CREATE POLICY "Sales managers can update payment details"
ON public.projects_v3
FOR UPDATE
USING (
  has_role(auth.uid(), 'sales_manager'::app_role)
  AND status = 'completed'
)
WITH CHECK (
  has_role(auth.uid(), 'sales_manager'::app_role)
);

DROP POLICY IF EXISTS "Sales managers can view completed orders" ON public.projects_v3;
CREATE POLICY "Sales managers can view completed orders"
ON public.projects_v3
FOR SELECT
USING (
  has_role(auth.uid(), 'sales_manager'::app_role)
  AND status IN ('completed','paid','closed')
);

-- 7) Cleanup: remove non-existent role approvals
DELETE FROM public.order_approvals 
WHERE approver_role = 'sales_manager_scaffold_execution_with_materials';

-- 8) Backfill: create sales_manager approvals for code=10 pending orders
INSERT INTO public.order_approvals(order_id, approver_role, created_at)
SELECT p.id, 'sales_manager', now()
FROM public.projects_v3 p
JOIN public.subcategories s ON s.id = p.subcategory_id
LEFT JOIN public.order_approvals oa ON oa.order_id = p.id AND oa.approver_role = 'sales_manager'
WHERE p.status = 'pending' AND s.code = '10' AND oa.id IS NULL;