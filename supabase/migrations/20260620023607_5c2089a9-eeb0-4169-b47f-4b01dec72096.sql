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
    IF TG_OP = 'INSERT' THEN
      _report_id := NEW.id;
      _module_key := NEW.module_key;
      _report_date := NEW.report_date;
      _actor_user_id := COALESCE(auth.uid(), NEW.created_by);
      _action := 'insert';
    ELSIF TG_OP = 'UPDATE' THEN
      _report_id := NEW.id;
      _module_key := NEW.module_key;
      _report_date := NEW.report_date;
      _actor_user_id := COALESCE(auth.uid(), NEW.created_by, OLD.created_by);
      _action := 'update';
    ELSE
      _report_id := OLD.id;
      _module_key := OLD.module_key;
      _report_date := OLD.report_date;
      _actor_user_id := COALESCE(auth.uid(), OLD.created_by);
      _action := 'delete';
    END IF;
  ELSE
    IF TG_OP = 'DELETE' THEN
      _report_id := OLD.daily_report_id;
    ELSE
      _report_id := NEW.daily_report_id;
    END IF;

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