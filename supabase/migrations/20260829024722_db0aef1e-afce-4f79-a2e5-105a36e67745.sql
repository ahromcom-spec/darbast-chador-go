-- انتقال سفارش
CREATE OR REPLACE FUNCTION public.notify_site_order_transfer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE p RECORD; from_name text; to_name text; ttl text; bdy text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  SELECT code, customer_name, customer_phone INTO p FROM public.projects_v3 WHERE id = NEW.order_id;
  SELECT full_name INTO from_name FROM public.profiles WHERE user_id = NEW.from_user_id;
  SELECT full_name INTO to_name FROM public.profiles WHERE user_id = NEW.to_user_id;

  IF TG_OP = 'INSERT' THEN
    ttl := 'درخواست انتقال سفارش';
  ELSE
    ttl := 'تغییر وضعیت انتقال سفارش: ' || COALESCE(NEW.status, '');
  END IF;

  bdy := 'از ' || COALESCE(from_name, '-') || ' به ' || COALESCE(to_name, NEW.to_phone_number, '-')
         || ' | وضعیت: ' || COALESCE(NEW.status, '-');

  INSERT INTO public.site_notifications (event_type, title, body, order_id, order_code, customer_name, customer_phone, actor_user_id, source_table, source_id)
  VALUES ('order_transfer', ttl, bdy, NEW.order_id, p.code, p.customer_name, p.customer_phone, NEW.from_user_id, 'order_transfer_requests', NEW.id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_site_order_transfer_ins ON public.order_transfer_requests;
CREATE TRIGGER trg_notify_site_order_transfer_ins
AFTER INSERT ON public.order_transfer_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_site_order_transfer();

DROP TRIGGER IF EXISTS trg_notify_site_order_transfer_upd ON public.order_transfer_requests;
CREATE TRIGGER trg_notify_site_order_transfer_upd
AFTER UPDATE ON public.order_transfer_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_site_order_transfer();

-- همکاری در سفارش
CREATE OR REPLACE FUNCTION public.notify_site_order_collaborator()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE p RECORD; inviter_name text; invitee_name text; ttl text; bdy text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  SELECT code, customer_name, customer_phone INTO p FROM public.projects_v3 WHERE id = NEW.order_id;
  SELECT full_name INTO inviter_name FROM public.profiles WHERE user_id = NEW.inviter_user_id;
  SELECT full_name INTO invitee_name FROM public.profiles WHERE user_id = NEW.invitee_user_id;

  IF TG_OP = 'INSERT' THEN
    ttl := 'افزودن همکار به سفارش';
  ELSE
    ttl := 'تغییر وضعیت همکاری سفارش: ' || COALESCE(NEW.status, '');
  END IF;

  bdy := 'دعوت‌کننده: ' || COALESCE(inviter_name, '-') || ' | همکار: '
         || COALESCE(invitee_name, NEW.invitee_phone_number, '-')
         || ' | وضعیت: ' || COALESCE(NEW.status, '-');

  INSERT INTO public.site_notifications (event_type, title, body, order_id, order_code, customer_name, customer_phone, actor_user_id, source_table, source_id)
  VALUES ('order_collaborator', ttl, bdy, NEW.order_id, p.code, p.customer_name, p.customer_phone, NEW.inviter_user_id, 'order_collaborators', NEW.id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_site_order_collaborator_ins ON public.order_collaborators;
CREATE TRIGGER trg_notify_site_order_collaborator_ins
AFTER INSERT ON public.order_collaborators
FOR EACH ROW EXECUTE FUNCTION public.notify_site_order_collaborator();

DROP TRIGGER IF EXISTS trg_notify_site_order_collaborator_upd ON public.order_collaborators;
CREATE TRIGGER trg_notify_site_order_collaborator_upd
AFTER UPDATE ON public.order_collaborators
FOR EACH ROW EXECUTE FUNCTION public.notify_site_order_collaborator();

-- تغییر مرحله سفارش
CREATE OR REPLACE FUNCTION public.notify_site_order_stage_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE bdy text;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status
     AND NEW.execution_stage IS NOT DISTINCT FROM OLD.execution_stage THEN
    RETURN NEW;
  END IF;

  bdy := 'وضعیت: ' || COALESCE(OLD.status::text, '-') || ' ← ' || COALESCE(NEW.status::text, '-')
         || ' | مرحله اجرا: ' || COALESCE(OLD.execution_stage::text, '-') || ' ← ' || COALESCE(NEW.execution_stage::text, '-');

  INSERT INTO public.site_notifications (event_type, title, body, order_id, order_code, customer_name, customer_phone, source_table, source_id)
  VALUES ('order_stage_change', 'تغییر مرحله سفارش', bdy, NEW.id, NEW.code, NEW.customer_name, NEW.customer_phone, 'projects_v3', NEW.id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_site_order_stage_change ON public.projects_v3;
CREATE TRIGGER trg_notify_site_order_stage_change
AFTER UPDATE ON public.projects_v3
FOR EACH ROW EXECUTE FUNCTION public.notify_site_order_stage_change();

-- ورود / بازدید کاربر
CREATE OR REPLACE FUNCTION public.notify_site_user_visit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE uname text; bdy text;
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    SELECT full_name INTO uname FROM public.profiles WHERE user_id = NEW.user_id;
  END IF;

  bdy := 'دستگاه: ' || COALESCE(NEW.device_type, '-')
         || ' | مرورگر: ' || COALESCE(NEW.browser_name, '-')
         || ' | صفحه ورود: ' || COALESCE(NEW.entry_page, '-')
         || ' | آی‌پی: ' || COALESCE(host(NEW.ip_address), '-');

  INSERT INTO public.site_notifications (event_type, title, body, customer_name, customer_phone, actor_user_id, source_table, source_id)
  VALUES (
    'user_visit',
    CASE WHEN COALESCE(NEW.is_logged_in, false) THEN 'ورود کاربر به سایت' ELSE 'بازدید مهمان از سایت' END,
    bdy,
    COALESCE(uname, 'مهمان'),
    NEW.phone_number,
    NEW.user_id,
    'site_sessions',
    NEW.id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_site_user_visit ON public.site_sessions;
CREATE TRIGGER trg_notify_site_user_visit
AFTER INSERT ON public.site_sessions
FOR EACH ROW EXECUTE FUNCTION public.notify_site_user_visit();