-- Fix database functions to include search_path for security
-- This prevents search_path hijacking attacks

-- Update validate_contractor_phone to set search_path
CREATE OR REPLACE FUNCTION public.validate_contractor_phone()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  IF NOT public.validate_phone_number(NEW.phone_number) THEN
    RAISE EXCEPTION 'شماره تلفن نامعتبر است. باید 11 رقم و با 09 شروع شود';
  END IF;
  RETURN NEW;
END;
$function$;

-- Update validate_profile_phone to set search_path
CREATE OR REPLACE FUNCTION public.validate_profile_phone()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  IF NEW.phone_number IS NOT NULL AND NOT public.validate_phone_number(NEW.phone_number) THEN
    RAISE EXCEPTION 'شماره تلفن نامعتبر است. باید 11 رقم و با 09 شروع شود';
  END IF;
  RETURN NEW;
END;
$function$;

-- Update handle_order_approval to set search_path
CREATE OR REPLACE FUNCTION public.handle_order_approval()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  customer_user_id UUID;
BEGIN
  IF OLD.status = 'pending' AND NEW.status IN ('approved', 'rejected') THEN
    SELECT user_id INTO customer_user_id
    FROM customers
    WHERE id = NEW.customer_id;
    
    IF customer_user_id IS NOT NULL THEN
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
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Update notify_new_staff_request to set search_path
CREATE OR REPLACE FUNCTION public.notify_new_staff_request()
RETURNS trigger
LANGUAGE plpgsql
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

-- Update create_approval_records to set search_path
CREATE OR REPLACE FUNCTION public.create_approval_records()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.status = 'pending' AND (OLD IS NULL OR OLD.status != 'pending') THEN
    INSERT INTO order_approvals (order_id, approver_role)
    VALUES 
      (NEW.id, 'ceo'),
      (NEW.id, 'scaffold_executive_manager'),
      (NEW.id, 'sales_manager');
  END IF;
  
  RETURN NEW;
END;
$function$;