-- ==========================================
-- Security Enhancement Migration
-- ==========================================

-- 1. Create assign_role_to_user function (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.assign_role_to_user(
  _user_id UUID,
  _role app_role
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- بررسی اینکه فقط admin یا general_manager می‌توانند این تابع را فراخوانی کنند
  IF NOT (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'general_manager'::app_role)
  ) THEN
    RAISE EXCEPTION 'دسترسی غیرمجاز: فقط مدیران می‌توانند نقش اختصاص دهند';
  END IF;

  -- افزودن نقش (با ignore duplicate)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, _role)
  ON CONFLICT (user_id, role) DO NOTHING;
  
  -- ثبت در audit log
  PERFORM public.log_audit(
    auth.uid(),
    'assign_role',
    'user_roles',
    _user_id,
    jsonb_build_object('role', _role)
  );
END;
$$;

-- 2. Create remove_role_from_user function (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.remove_role_from_user(
  _user_id UUID,
  _role app_role
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- بررسی دسترسی
  IF NOT (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'general_manager'::app_role)
  ) THEN
    RAISE EXCEPTION 'دسترسی غیرمجاز: فقط مدیران می‌توانند نقش حذف کنند';
  END IF;

  -- حذف نقش
  DELETE FROM public.user_roles
  WHERE user_id = _user_id AND role = _role;
  
  -- ثبت در audit log
  PERFORM public.log_audit(
    auth.uid(),
    'remove_role',
    'user_roles',
    _user_id,
    jsonb_build_object('role', _role)
  );
END;
$$;

-- 3. Create validate_phone_number function
CREATE OR REPLACE FUNCTION public.validate_phone_number(_phone TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- بررسی فرمت شماره موبایل ایران (11 رقم، شروع با 09)
  RETURN _phone ~ '^09[0-9]{9}$';
END;
$$;

-- 4. Add trigger to validate phone numbers on contractor insert/update
CREATE OR REPLACE FUNCTION public.validate_contractor_phone()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT public.validate_phone_number(NEW.phone_number) THEN
    RAISE EXCEPTION 'شماره تلفن نامعتبر است. باید 11 رقم و با 09 شروع شود';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_contractor_phone_trigger ON public.contractors;
CREATE TRIGGER validate_contractor_phone_trigger
BEFORE INSERT OR UPDATE ON public.contractors
FOR EACH ROW
EXECUTE FUNCTION public.validate_contractor_phone();

-- 5. Add trigger to validate phone numbers on profiles insert/update
CREATE OR REPLACE FUNCTION public.validate_profile_phone()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.phone_number IS NOT NULL AND NOT public.validate_phone_number(NEW.phone_number) THEN
    RAISE EXCEPTION 'شماره تلفن نامعتبر است. باید 11 رقم و با 09 شروع شود';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_profile_phone_trigger ON public.profiles;
CREATE TRIGGER validate_profile_phone_trigger
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.validate_profile_phone();

-- 6. Update notify_staff_request_decision trigger to use new function
CREATE OR REPLACE FUNCTION public.notify_staff_request_decision_v2()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'pending' AND NEW.status IN ('approved', 'rejected') THEN
    IF NEW.status = 'approved' THEN
      -- استفاده از تابع امن assign_role_to_user
      PERFORM public.assign_role_to_user(NEW.user_id, NEW.requested_role);
      
      PERFORM public.send_notification(
        NEW.user_id,
        'درخواست تأیید شد',
        'درخواست نقش ' || NEW.requested_role || ' شما تأیید شد.',
        '/profile',
        'success'
      );
    ELSE
      PERFORM public.send_notification(
        NEW.user_id,
        'درخواست رد شد',
        'درخواست نقش شما رد شد. دلیل: ' || COALESCE(NEW.rejection_reason, 'ذکر نشده'),
        '/profile',
        'error'
      );
      
      PERFORM public.log_audit(
        NEW.approved_by,
        'reject_staff_request',
        'staff_profiles',
        NEW.id,
        jsonb_build_object('role', NEW.requested_role, 'user_id', NEW.user_id, 'reason', NEW.rejection_reason)
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;