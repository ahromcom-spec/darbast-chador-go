-- Fix 1: Create a database function to solve N+1 query problem in CEO orders
CREATE OR REPLACE FUNCTION public.get_orders_with_customer_info()
RETURNS TABLE (
  id uuid,
  customer_id uuid,
  contractor_id uuid,
  province_id uuid,
  district_id uuid,
  subcategory_id uuid,
  status project_status_v3,
  created_at timestamptz,
  updated_at timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  address text,
  detailed_address text,
  notes text,
  rejection_reason text,
  project_number text,
  service_code text,
  code text,
  customer_name text,
  customer_phone text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id,
    p.customer_id,
    p.contractor_id,
    p.province_id,
    p.district_id,
    p.subcategory_id,
    p.status,
    p.created_at,
    p.updated_at,
    p.approved_by,
    p.approved_at,
    p.address,
    p.detailed_address,
    p.notes,
    p.rejection_reason,
    p.project_number,
    p.service_code,
    p.code,
    prof.full_name as customer_name,
    prof.phone_number as customer_phone
  FROM projects_v3 p
  INNER JOIN customers c ON c.id = p.customer_id
  INNER JOIN profiles prof ON prof.user_id = c.user_id
  WHERE has_role(auth.uid(), 'ceo'::app_role)
$$;

-- Fix 2: Convert trigger-only functions from SECURITY DEFINER to SECURITY INVOKER
-- These functions are only called by triggers, so they should use SECURITY INVOKER

CREATE OR REPLACE FUNCTION public.notify_new_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
  ceo_user_id UUID;
  customer_name TEXT;
BEGIN
  IF NEW.status = 'pending' THEN
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
    
    PERFORM log_audit(
      NEW.customer_id,
      'create_order',
      'projects_v3',
      NEW.id,
      jsonb_build_object('code', NEW.code, 'status', NEW.status)
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_order_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
  customer_user_id UUID;
BEGIN
  IF OLD.status = 'pending' AND NEW.status IN ('approved', 'rejected') THEN
    SELECT user_id INTO customer_user_id
    FROM customers
    WHERE id = NEW.customer_id;
    
    IF NEW.status = 'approved' THEN
      PERFORM send_notification(
        customer_user_id,
        'سفارش تایید شد ✅',
        'سفارش شما با کد ' || NEW.code || ' توسط مدیر تایید شد و به زودی اقدامات لازم انجام خواهد شد.',
        '/projects',
        'success'
      );
      
      PERFORM log_audit(
        NEW.approved_by,
        'approve_order',
        'projects_v3',
        NEW.id,
        jsonb_build_object('code', NEW.code, 'customer_id', NEW.customer_id)
      );
    ELSE
      PERFORM send_notification(
        customer_user_id,
        'سفارش رد شد ❌',
        'سفارش شما با کد ' || NEW.code || ' رد شد. دلیل: ' || COALESCE(NEW.rejection_reason, 'ذکر نشده'),
        '/projects',
        'error'
      );
      
      PERFORM log_audit(
        NEW.approved_by,
        'reject_order',
        'projects_v3',
        NEW.id,
        jsonb_build_object('code', NEW.code, 'customer_id', NEW.customer_id, 'reason', NEW.rejection_reason)
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_new_staff_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
  gm_user_id UUID;
  requester_name TEXT;
BEGIN
  SELECT ur.user_id INTO gm_user_id
  FROM public.user_roles ur
  WHERE ur.role = 'general_manager'
  LIMIT 1;
  
  SELECT p.full_name INTO requester_name
  FROM public.profiles p
  WHERE p.user_id = NEW.user_id;
  
  IF gm_user_id IS NOT NULL THEN
    PERFORM public.send_notification(
      gm_user_id,
      'درخواست نقش جدید',
      requester_name || ' درخواست نقش ' || NEW.requested_role || ' داده است.',
      '/admin/staff-requests',
      'info'
    );
  END IF;
  
  RETURN NEW;
END;
$function$;