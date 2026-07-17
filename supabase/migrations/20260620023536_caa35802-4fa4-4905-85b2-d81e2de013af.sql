CREATE OR REPLACE FUNCTION public.daily_report_module_label(_module_key text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE _module_key
    WHEN 'daily_report' THEN 'گزارش روزانه شرکت اهرم'
    WHEN 'daily_report_executive' THEN 'گزارش روزانه اجرایی اهرم'
    WHEN 'daily_report_management' THEN 'گزارش روزانه مدیریت اهرم'
    WHEN 'daily_report_support' THEN 'گزارش روزانه پشتیبانی اهرم'
    WHEN 'daily_report_full' THEN 'گزارش روزانه کلی اهرم'
    WHEN 'daily_report_all' THEN 'گزارش روزانه کلی اهرم'
    WHEN 'daily_report_total' THEN 'گزارش روزانه کلی اهرم'
    ELSE COALESCE(_module_key, 'گزارش روزانه')
  END
$$;

CREATE OR REPLACE FUNCTION public.log_daily_report_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _report_id uuid;
  _module_key text;
  _report_date date;
  _actor_user_id uuid;
  _actor_name text;
  _actor_phone text;
  _action text;
  _event_type text;
  _module_label text;
BEGIN
  IF TG_TABLE_NAME = 'daily_reports' THEN
    _report_id := COALESCE(NEW.id, OLD.id);
    _module_key := COALESCE(NEW.module_key, OLD.module_key);
    _report_date := COALESCE(NEW.report_date, OLD.report_date);
    _actor_user_id := COALESCE(auth.uid(), NEW.created_by, OLD.created_by);
    _action := CASE WHEN TG_OP = 'INSERT' THEN 'insert' ELSE 'update' END;
  ELSE
    _report_id := COALESCE(NEW.daily_report_id, OLD.daily_report_id);

    SELECT dr.module_key, dr.report_date, COALESCE(auth.uid(), dr.created_by)
      INTO _module_key, _report_date, _actor_user_id
    FROM public.daily_reports dr
    WHERE dr.id = _report_id;

    _action := 'update';
  END IF;

  IF _report_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.activity_logs al
    WHERE al.event_category = 'daily_report'
      AND al.entity_table = 'daily_reports'
      AND al.entity_id = _report_id::text
      AND al.occurred_at > now() - interval '15 seconds'
    LIMIT 1
  ) THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  SELECT p.full_name, p.phone_number
    INTO _actor_name, _actor_phone
  FROM public.profiles p
  WHERE p.user_id = _actor_user_id
  LIMIT 1;

  _module_label := public.daily_report_module_label(_module_key);
  _event_type := CASE WHEN _action = 'insert' THEN 'ذخیره گزارش روزانه' ELSE 'ویرایش گزارش روزانه' END;

  INSERT INTO public.activity_logs (
    event_type,
    event_category,
    action,
    module_name,
    entity_table,
    entity_id,
    title,
    details,
    actor_user_id,
    actor_name,
    actor_phone
  ) VALUES (
    _event_type,
    'daily_report',
    _action,
    _module_label,
    'daily_reports',
    _report_id::text,
    _event_type || ' — ' || COALESCE(_report_date::text, ''),
    jsonb_build_object(
      'source', 'database_trigger',
      'moduleKey', _module_key,
      'reportDate', _report_date,
      'table', TG_TABLE_NAME,
      'operation', TG_OP
    ),
    _actor_user_id,
    _actor_name,
    _actor_phone
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
EXCEPTION WHEN OTHERS THEN
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_daily_reports_activity ON public.daily_reports;
CREATE TRIGGER trg_log_daily_reports_activity
AFTER INSERT OR UPDATE ON public.daily_reports
FOR EACH ROW EXECUTE FUNCTION public.log_daily_report_activity();

DROP TRIGGER IF EXISTS trg_log_daily_report_orders_activity ON public.daily_report_orders;
CREATE TRIGGER trg_log_daily_report_orders_activity
AFTER INSERT OR UPDATE OR DELETE ON public.daily_report_orders
FOR EACH ROW EXECUTE FUNCTION public.log_daily_report_activity();

DROP TRIGGER IF EXISTS trg_log_daily_report_staff_activity ON public.daily_report_staff;
CREATE TRIGGER trg_log_daily_report_staff_activity
AFTER INSERT OR UPDATE OR DELETE ON public.daily_report_staff
FOR EACH ROW EXECUTE FUNCTION public.log_daily_report_activity();