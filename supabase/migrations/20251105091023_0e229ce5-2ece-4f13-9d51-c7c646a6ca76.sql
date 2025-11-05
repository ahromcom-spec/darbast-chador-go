-- Function to get user_id from phone number
CREATE OR REPLACE FUNCTION public.get_user_id_by_phone(_phone text)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT user_id FROM public.profiles WHERE phone_number = _phone LIMIT 1;
$$;

-- Update create_approval_records to create 3 approvals for scaffolding with materials
CREATE OR REPLACE FUNCTION public.create_approval_records()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_subcategory_code TEXT;
  v_manager1_id UUID;
  v_manager2_id UUID;
  v_sales_manager_id UUID;
BEGIN
  IF NEW.status = 'pending' AND (TG_OP = 'INSERT' OR (OLD IS NOT NULL AND OLD.status IS DISTINCT FROM NEW.status)) THEN
    SELECT s.code INTO v_subcategory_code
    FROM public.subcategories s
    WHERE s.id = NEW.subcategory_id;
    
    -- For scaffolding execution with materials (code '10')
    IF v_subcategory_code = '10' THEN
      -- Get user IDs for the three managers
      v_manager1_id := public.get_user_id_by_phone('09011111111');
      v_manager2_id := public.get_user_id_by_phone('09012121212');
      v_sales_manager_id := public.get_user_id_by_phone('09013131313');
      
      -- Create approval record for first manager (services manager)
      IF v_manager1_id IS NOT NULL THEN
        INSERT INTO public.order_approvals (order_id, approver_role, approver_user_id, created_at)
        VALUES (NEW.id, 'scaffold_execution_materials_manager', v_manager1_id, now())
        ON CONFLICT DO NOTHING;
      END IF;
      
      -- Create approval record for executive manager
      IF v_manager2_id IS NOT NULL THEN
        INSERT INTO public.order_approvals (order_id, approver_role, approver_user_id, created_at)
        VALUES (NEW.id, 'scaffold_executive_manager', v_manager2_id, now())
        ON CONFLICT DO NOTHING;
      END IF;
      
      -- Create approval record for sales manager
      IF v_sales_manager_id IS NOT NULL THEN
        INSERT INTO public.order_approvals (order_id, approver_role, approver_user_id, created_at)
        VALUES (NEW.id, 'sales_manager', v_sales_manager_id, now())
        ON CONFLICT DO NOTHING;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Update notify_new_order to notify the 3 specific managers
CREATE OR REPLACE FUNCTION public.notify_new_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  customer_name TEXT;
  customer_user_id UUID;
  subcategory_code TEXT;
  v_manager1_id UUID;
  v_manager2_id UUID;
  v_sales_manager_id UUID;
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
    
    -- Get the three manager IDs
    v_manager1_id := public.get_user_id_by_phone('09011111111');
    v_manager2_id := public.get_user_id_by_phone('09012121212');
    v_sales_manager_id := public.get_user_id_by_phone('09013131313');
    
    -- Notify first manager (services manager)
    IF v_manager1_id IS NOT NULL THEN
      PERFORM public.send_notification(
        v_manager1_id,
        'سفارش جدید در انتظار تایید',
        COALESCE(customer_name, 'مشتری') || ' یک سفارش داربست با اجناس ثبت کرده است. کد سفارش: ' || NEW.code,
        '/admin/pending-orders',
        'info'
      );
    END IF;
    
    -- Notify executive manager
    IF v_manager2_id IS NOT NULL THEN
      PERFORM public.send_notification(
        v_manager2_id,
        'سفارش جدید در انتظار تایید',
        COALESCE(customer_name, 'مشتری') || ' یک سفارش داربست با اجناس ثبت کرده است. کد سفارش: ' || NEW.code,
        '/executive/pending-orders',
        'info'
      );
    END IF;
    
    -- Notify sales manager
    IF v_sales_manager_id IS NOT NULL THEN
      PERFORM public.send_notification(
        v_sales_manager_id,
        'سفارش جدید در انتظار تایید فروش',
        COALESCE(customer_name, 'مشتری') || ' یک سفارش داربست با اجناس ثبت کرده است. کد سفارش: ' || NEW.code,
        '/sales/pending-orders',
        'info'
      );
    END IF;
    
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