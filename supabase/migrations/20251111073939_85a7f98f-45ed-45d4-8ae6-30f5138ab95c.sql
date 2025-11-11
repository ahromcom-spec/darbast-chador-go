-- Fix duplicate notifications issue
-- Remove customer notification from notify_new_order since trigger_order_automation already sends it
-- This prevents sending 3 identical notifications to the customer

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
  subcategory_name TEXT;
BEGIN
  -- Fetch subcategory code and name
  SELECT s.code, s.name INTO subcategory_code, subcategory_name
  FROM public.subcategories AS s
  WHERE s.id = NEW.subcategory_id;

  -- Only for scaffolding with materials (code '10') when order is pending
  IF NEW.status = 'pending' AND (TG_OP = 'INSERT' OR OLD.status != 'pending') AND subcategory_code = '10' THEN
    -- Get customer user id and name
    SELECT c.user_id INTO customer_user_id
    FROM public.customers AS c
    WHERE c.id = NEW.customer_id;

    SELECT p.full_name INTO customer_name
    FROM public.profiles AS p
    JOIN public.customers AS c ON c.user_id = p.user_id
    WHERE c.id = NEW.customer_id;

    -- NOTE: Customer notification is handled by trigger_order_automation to avoid duplicates
    -- We only notify managers here

    -- Notify CEO
    PERFORM public.notify_role(
      'ceo'::app_role,
      'سفارش جدید ' || NEW.code,
      'سفارش جدید از ' || COALESCE(customer_name, 'مشتری') || ' ثبت شد و منتظر تأیید است.',
      '/ceo/orders',
      'info'
    );

    -- Notify executive manager
    PERFORM public.notify_role(
      'scaffold_executive_manager'::app_role,
      'سفارش جدید در انتظار تایید',
      COALESCE(customer_name, 'مشتری') || ' یک سفارش داربست با اجناس ثبت کرده است. کد سفارش: ' || NEW.code,
      '/executive/pending-orders',
      'info'
    );

    -- Notify sales manager
    PERFORM public.notify_role(
      'sales_manager'::app_role,
      'سفارش جدید در انتظار تایید فروش',
      'سفارش با کد ' || NEW.code || ' برای تایید فروش منتظر شماست.',
      '/sales/pending-orders',
      'info'
    );

    -- Audit (only on INSERT)
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