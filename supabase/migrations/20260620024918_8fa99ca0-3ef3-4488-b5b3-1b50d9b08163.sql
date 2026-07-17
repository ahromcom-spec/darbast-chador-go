
CREATE OR REPLACE FUNCTION public.log_daily_report_activity()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
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
  _changes jsonb := '[]'::jsonb;
  _summary text := '';
  _row_label text := '';
  _title text;

  -- helper holders
  _old_txt text;
  _new_txt text;

  -- field map: array of arrays [col, label]
BEGIN
  IF TG_TABLE_NAME = 'daily_reports' THEN
    IF TG_OP = 'INSERT' THEN
      _report_id := NEW.id;
      _module_key := NEW.module_key;
      _report_date := NEW.report_date;
      _actor_user_id := COALESCE(auth.uid(), NEW.created_by);
      _action := 'insert';
      IF NEW.notes IS NOT NULL AND length(btrim(NEW.notes)) > 0 THEN
        _changes := _changes || jsonb_build_object(
          'field','notes','label','یادداشت گزارش','old',NULL,'new',NEW.notes
        );
      END IF;
    ELSIF TG_OP = 'UPDATE' THEN
      _report_id := NEW.id;
      _module_key := NEW.module_key;
      _report_date := NEW.report_date;
      _actor_user_id := COALESCE(auth.uid(), NEW.created_by, OLD.created_by);
      _action := 'update';
      IF COALESCE(OLD.notes,'') IS DISTINCT FROM COALESCE(NEW.notes,'') THEN
        _changes := _changes || jsonb_build_object(
          'field','notes','label','یادداشت گزارش','old',OLD.notes,'new',NEW.notes
        );
      END IF;
    ELSE
      _report_id := OLD.id;
      _module_key := OLD.module_key;
      _report_date := OLD.report_date;
      _actor_user_id := COALESCE(auth.uid(), OLD.created_by);
      _action := 'delete';
    END IF;

  ELSIF TG_TABLE_NAME = 'daily_report_orders' THEN
    IF TG_OP = 'DELETE' THEN
      _report_id := OLD.daily_report_id;
      _row_label := COALESCE(NULLIF(OLD.team_name,''), 'ردیف سفارش');
    ELSE
      _report_id := NEW.daily_report_id;
      _row_label := COALESCE(NULLIF(NEW.team_name,''), 'ردیف سفارش');
    END IF;
    _action := CASE WHEN TG_OP='INSERT' THEN 'insert' WHEN TG_OP='DELETE' THEN 'delete' ELSE 'update' END;

    IF TG_OP = 'INSERT' THEN
      IF NEW.activity_description IS NOT NULL AND length(btrim(NEW.activity_description))>0 THEN
        _changes := _changes || jsonb_build_object('field','activity_description','label','شرح فعالیت و ابعاد','old',NULL,'new',NEW.activity_description,'row',_row_label);
      END IF;
      IF NEW.service_details IS NOT NULL AND length(btrim(NEW.service_details))>0 THEN
        _changes := _changes || jsonb_build_object('field','service_details','label','جزئیات خدمات','old',NULL,'new',NEW.service_details,'row',_row_label);
      END IF;
      IF NEW.team_name IS NOT NULL AND length(btrim(NEW.team_name))>0 THEN
        _changes := _changes || jsonb_build_object('field','team_name','label','اکیپ','old',NULL,'new',NEW.team_name,'row',_row_label);
      END IF;
      IF NEW.notes IS NOT NULL AND length(btrim(NEW.notes))>0 THEN
        _changes := _changes || jsonb_build_object('field','notes','label','توضیحات','old',NULL,'new',NEW.notes,'row',_row_label);
      END IF;
    ELSIF TG_OP = 'UPDATE' THEN
      IF COALESCE(OLD.activity_description,'') IS DISTINCT FROM COALESCE(NEW.activity_description,'') THEN
        _changes := _changes || jsonb_build_object('field','activity_description','label','شرح فعالیت و ابعاد','old',OLD.activity_description,'new',NEW.activity_description,'row',_row_label);
      END IF;
      IF COALESCE(OLD.service_details,'') IS DISTINCT FROM COALESCE(NEW.service_details,'') THEN
        _changes := _changes || jsonb_build_object('field','service_details','label','جزئیات خدمات','old',OLD.service_details,'new',NEW.service_details,'row',_row_label);
      END IF;
      IF COALESCE(OLD.team_name,'') IS DISTINCT FROM COALESCE(NEW.team_name,'') THEN
        _changes := _changes || jsonb_build_object('field','team_name','label','اکیپ','old',OLD.team_name,'new',NEW.team_name,'row',_row_label);
      END IF;
      IF COALESCE(OLD.notes,'') IS DISTINCT FROM COALESCE(NEW.notes,'') THEN
        _changes := _changes || jsonb_build_object('field','notes','label','توضیحات','old',OLD.notes,'new',NEW.notes,'row',_row_label);
      END IF;
    END IF;

    SELECT dr.module_key, dr.report_date, COALESCE(auth.uid(), dr.created_by)
      INTO _module_key, _report_date, _actor_user_id
    FROM public.daily_reports dr
    WHERE dr.id = _report_id;

  ELSIF TG_TABLE_NAME = 'daily_report_staff' THEN
    IF TG_OP = 'DELETE' THEN
      _report_id := OLD.daily_report_id;
      _row_label := COALESCE(NULLIF(OLD.staff_name,''), 'پرسنل');
    ELSE
      _report_id := NEW.daily_report_id;
      _row_label := COALESCE(NULLIF(NEW.staff_name,''), 'پرسنل');
    END IF;
    _action := CASE WHEN TG_OP='INSERT' THEN 'insert' WHEN TG_OP='DELETE' THEN 'delete' ELSE 'update' END;

    IF TG_OP = 'INSERT' THEN
      IF NEW.staff_name IS NOT NULL THEN
        _changes := _changes || jsonb_build_object('field','staff_name','label','نام پرسنل','old',NULL,'new',NEW.staff_name,'row',_row_label);
      END IF;
      IF NEW.work_status IS NOT NULL THEN
        _changes := _changes || jsonb_build_object('field','work_status','label','وضعیت','old',NULL,'new',NEW.work_status,'row',_row_label);
      END IF;
      IF COALESCE(NEW.amount_received,0) <> 0 THEN
        _changes := _changes || jsonb_build_object('field','amount_received','label','دریافتی','old',NULL,'new',NEW.amount_received,'row',_row_label);
      END IF;
      IF COALESCE(NEW.amount_spent,0) <> 0 THEN
        _changes := _changes || jsonb_build_object('field','amount_spent','label','پرداختی','old',NULL,'new',NEW.amount_spent,'row',_row_label);
      END IF;
      IF NEW.receiving_notes IS NOT NULL AND length(btrim(NEW.receiving_notes))>0 THEN
        _changes := _changes || jsonb_build_object('field','receiving_notes','label','یادداشت دریافت','old',NULL,'new',NEW.receiving_notes,'row',_row_label);
      END IF;
      IF NEW.spending_notes IS NOT NULL AND length(btrim(NEW.spending_notes))>0 THEN
        _changes := _changes || jsonb_build_object('field','spending_notes','label','یادداشت پرداخت','old',NULL,'new',NEW.spending_notes,'row',_row_label);
      END IF;
      IF NEW.notes IS NOT NULL AND length(btrim(NEW.notes))>0 THEN
        _changes := _changes || jsonb_build_object('field','notes','label','توضیحات','old',NULL,'new',NEW.notes,'row',_row_label);
      END IF;
    ELSIF TG_OP = 'UPDATE' THEN
      IF COALESCE(OLD.staff_name,'') IS DISTINCT FROM COALESCE(NEW.staff_name,'') THEN
        _changes := _changes || jsonb_build_object('field','staff_name','label','نام پرسنل','old',OLD.staff_name,'new',NEW.staff_name,'row',_row_label);
      END IF;
      IF COALESCE(OLD.work_status,'') IS DISTINCT FROM COALESCE(NEW.work_status,'') THEN
        _changes := _changes || jsonb_build_object('field','work_status','label','وضعیت','old',OLD.work_status,'new',NEW.work_status,'row',_row_label);
      END IF;
      IF COALESCE(OLD.overtime_hours,0) IS DISTINCT FROM COALESCE(NEW.overtime_hours,0) THEN
        _changes := _changes || jsonb_build_object('field','overtime_hours','label','اضافه‌کار (ساعت)','old',OLD.overtime_hours,'new',NEW.overtime_hours,'row',_row_label);
      END IF;
      IF COALESCE(OLD.amount_received,0) IS DISTINCT FROM COALESCE(NEW.amount_received,0) THEN
        _changes := _changes || jsonb_build_object('field','amount_received','label','دریافتی','old',OLD.amount_received,'new',NEW.amount_received,'row',_row_label);
      END IF;
      IF COALESCE(OLD.receiving_notes,'') IS DISTINCT FROM COALESCE(NEW.receiving_notes,'') THEN
        _changes := _changes || jsonb_build_object('field','receiving_notes','label','یادداشت دریافت','old',OLD.receiving_notes,'new',NEW.receiving_notes,'row',_row_label);
      END IF;
      IF COALESCE(OLD.amount_spent,0) IS DISTINCT FROM COALESCE(NEW.amount_spent,0) THEN
        _changes := _changes || jsonb_build_object('field','amount_spent','label','پرداختی','old',OLD.amount_spent,'new',NEW.amount_spent,'row',_row_label);
      END IF;
      IF COALESCE(OLD.spending_notes,'') IS DISTINCT FROM COALESCE(NEW.spending_notes,'') THEN
        _changes := _changes || jsonb_build_object('field','spending_notes','label','یادداشت پرداخت','old',OLD.spending_notes,'new',NEW.spending_notes,'row',_row_label);
      END IF;
      IF COALESCE(OLD.notes,'') IS DISTINCT FROM COALESCE(NEW.notes,'') THEN
        _changes := _changes || jsonb_build_object('field','notes','label','توضیحات','old',OLD.notes,'new',NEW.notes,'row',_row_label);
      END IF;
    END IF;

    SELECT dr.module_key, dr.report_date, COALESCE(auth.uid(), dr.created_by)
      INTO _module_key, _report_date, _actor_user_id
    FROM public.daily_reports dr
    WHERE dr.id = _report_id;
  END IF;

  IF _report_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  -- If nothing meaningful changed on an update, skip
  IF _action = 'update' AND jsonb_array_length(_changes) = 0 THEN
    RETURN NEW;
  END IF;

  -- Lookup actor profile
  SELECT p.full_name, p.phone_number
    INTO _actor_name, _actor_phone
  FROM public.profiles p
  WHERE p.user_id = _actor_user_id
  LIMIT 1;

  _module_label := public.daily_report_module_label(_module_key);

  -- Build a short Persian summary of changes
  IF jsonb_array_length(_changes) > 0 THEN
    SELECT string_agg(
      (c->>'label') ||
      CASE
        WHEN c->>'row' IS NOT NULL AND length(c->>'row')>0 THEN ' ('||(c->>'row')||')'
        ELSE ''
      END ||
      ': ' ||
      CASE
        WHEN c->>'old' IS NULL OR length(coalesce(c->>'old',''))=0 THEN '«'||COALESCE(c->>'new','')||'»'
        WHEN c->>'new' IS NULL OR length(coalesce(c->>'new',''))=0 THEN '«'||COALESCE(c->>'old','')||'» → حذف'
        ELSE '«'||(c->>'old')||'» → «'||(c->>'new')||'»'
      END,
      E'\n'
    )
    INTO _summary
    FROM jsonb_array_elements(_changes) c;
  END IF;

  _event_type := CASE WHEN _action = 'insert' THEN 'ذخیره گزارش روزانه' WHEN _action='delete' THEN 'حذف از گزارش روزانه' ELSE 'ویرایش گزارش روزانه' END;

  _title := _event_type || ' — ' || to_char(_report_date, 'YYYY-MM-DD');
  IF _summary IS NOT NULL AND length(_summary) > 0 THEN
    _title := _title || ' — ' || left(regexp_replace(_summary, E'\\s+', ' ', 'g'), 120);
  END IF;

  INSERT INTO public.activity_logs (
    event_type,
    event_category,
    action,
    module_name,
    entity_table,
    entity_id,
    title,
    details,
    diff,
    actor_user_id,
    actor_name,
    actor_phone
  ) VALUES (
    _event_type,
    'daily_report',
    _action,
    _module_label,
    TG_TABLE_NAME,
    _report_id::text,
    _title,
    jsonb_build_object(
      'moduleKey', _module_key,
      'reportDate', _report_date,
      'changes', _changes,
      'summary', _summary,
      'rowTable', TG_TABLE_NAME
    ),
    CASE WHEN jsonb_array_length(_changes) > 0 THEN _changes ELSE NULL END,
    _actor_user_id,
    _actor_name,
    _actor_phone
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$function$;

-- Make sure delete triggers exist too
DROP TRIGGER IF EXISTS trg_log_daily_report_orders_activity ON public.daily_report_orders;
CREATE TRIGGER trg_log_daily_report_orders_activity
  AFTER INSERT OR UPDATE OR DELETE ON public.daily_report_orders
  FOR EACH ROW EXECUTE FUNCTION public.log_daily_report_activity();

DROP TRIGGER IF EXISTS trg_log_daily_report_staff_activity ON public.daily_report_staff;
CREATE TRIGGER trg_log_daily_report_staff_activity
  AFTER INSERT OR UPDATE OR DELETE ON public.daily_report_staff
  FOR EACH ROW EXECUTE FUNCTION public.log_daily_report_activity();
