-- فاز 1 - مرحله 4: Functionsها و Triggersها

-- تریگر برای updated_at
CREATE TRIGGER update_staff_profiles_updated_at
  BEFORE UPDATE ON public.staff_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function برای بررسی وجود در whitelist
CREATE OR REPLACE FUNCTION public.check_staff_whitelist(_phone TEXT)
RETURNS TABLE(is_whitelisted BOOLEAN, allowed_role app_role)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    EXISTS(SELECT 1 FROM public.staff_whitelist WHERE phone = _phone)::BOOLEAN,
    (SELECT staff_whitelist.allowed_role FROM public.staff_whitelist WHERE phone = _phone LIMIT 1);
$$;

-- Function برای ثبت در audit log
CREATE OR REPLACE FUNCTION public.log_audit(
  _actor_user_id UUID,
  _action TEXT,
  _entity TEXT,
  _entity_id UUID,
  _meta JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO public.audit_log (actor_user_id, action, entity, entity_id, meta)
  VALUES (_actor_user_id, _action, _entity, _entity_id, _meta)
  RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$;

-- Function برای ارسال اعلان
CREATE OR REPLACE FUNCTION public.send_notification(
  _user_id UUID,
  _title TEXT,
  _body TEXT,
  _link TEXT DEFAULT NULL,
  _type TEXT DEFAULT 'info'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  notif_id UUID;
BEGIN
  INSERT INTO public.notifications (user_id, title, body, link, type)
  VALUES (_user_id, _title, _body, _link, _type)
  RETURNING id INTO notif_id;
  
  RETURN notif_id;
END;
$$;

-- Trigger برای ارسال اعلان هنگام ثبت درخواست نقش جدید
CREATE OR REPLACE FUNCTION public.notify_new_staff_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  gm_user_id UUID;
  requester_name TEXT;
BEGIN
  -- پیدا کردن مدیرکل
  SELECT ur.user_id INTO gm_user_id
  FROM public.user_roles ur
  WHERE ur.role = 'general_manager'
  LIMIT 1;
  
  -- دریافت نام درخواست‌دهنده
  SELECT p.full_name INTO requester_name
  FROM public.profiles p
  WHERE p.user_id = NEW.user_id;
  
  -- ارسال اعلان به مدیرکل
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
$$;

DROP TRIGGER IF EXISTS on_staff_request_created ON public.staff_profiles;
CREATE TRIGGER on_staff_request_created
  AFTER INSERT ON public.staff_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_staff_request();

-- Trigger برای ارسال اعلان و افزودن نقش هنگام تأیید/رد
CREATE OR REPLACE FUNCTION public.notify_staff_request_decision()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'pending' AND NEW.status IN ('approved', 'rejected') THEN
    IF NEW.status = 'approved' THEN
      -- تأیید شد
      PERFORM public.send_notification(
        NEW.user_id,
        'درخواست تأیید شد',
        'درخواست نقش ' || NEW.requested_role || ' شما تأیید شد.',
        '/profile',
        'success'
      );
      
      -- افزودن نقش به user_roles
      INSERT INTO public.user_roles (user_id, role)
      VALUES (NEW.user_id, NEW.requested_role)
      ON CONFLICT (user_id, role) DO NOTHING;
      
      -- ثبت در audit log
      PERFORM public.log_audit(
        NEW.approved_by,
        'approve_staff_request',
        'staff_profiles',
        NEW.id,
        jsonb_build_object('role', NEW.requested_role, 'user_id', NEW.user_id)
      );
      
    ELSE
      -- رد شد
      PERFORM public.send_notification(
        NEW.user_id,
        'درخواست رد شد',
        'درخواست نقش شما رد شد. دلیل: ' || COALESCE(NEW.rejection_reason, 'ذکر نشده'),
        '/profile',
        'error'
      );
      
      -- ثبت در audit log
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

DROP TRIGGER IF EXISTS on_staff_request_decision ON public.staff_profiles;
CREATE TRIGGER on_staff_request_decision
  AFTER UPDATE ON public.staff_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_staff_request_decision();