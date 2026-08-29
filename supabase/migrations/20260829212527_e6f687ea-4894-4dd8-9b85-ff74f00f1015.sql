CREATE OR REPLACE FUNCTION public.notify_site_user_visit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uname text;
  uphone text;
  bdy text;
  ttl text;
  known_user_id uuid;
  known_name text;
  known_phone text;
  prev_visits int := 0;
  is_returning boolean := false;
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    SELECT full_name, phone_number INTO uname, uphone
    FROM public.profiles WHERE user_id = NEW.user_id;
  END IF;

  -- تعداد بازدیدهای قبلی همین دستگاه/آی‌پی
  SELECT count(*) INTO prev_visits
  FROM public.site_sessions s
  WHERE s.id <> NEW.id
    AND (
      (NEW.ip_address IS NOT NULL AND s.ip_address = NEW.ip_address)
      OR (NEW.user_id IS NOT NULL AND s.user_id = NEW.user_id)
    );

  -- شناسایی مهمان: آیا این دستگاه/آی‌پی قبلاً با حساب ثبت‌نام‌شده وارد شده؟
  IF NEW.user_id IS NULL AND NEW.ip_address IS NOT NULL THEN
    SELECT s.user_id INTO known_user_id
    FROM public.site_sessions s
    WHERE s.user_id IS NOT NULL
      AND s.ip_address = NEW.ip_address
      AND (NEW.user_agent IS NULL OR s.user_agent IS NULL OR s.user_agent = NEW.user_agent)
    ORDER BY s.started_at DESC NULLS LAST
    LIMIT 1;

    IF known_user_id IS NOT NULL THEN
      SELECT full_name, phone_number INTO known_name, known_phone
      FROM public.profiles WHERE user_id = known_user_id;
      is_returning := true;
    END IF;
  END IF;

  bdy := 'نام: ' || COALESCE(uname, known_name, 'مهمان (ثبت‌نام نشده)')
      || ' | شماره: ' || COALESCE(NEW.phone_number, uphone, known_phone, '-')
      || CASE WHEN is_returning THEN ' | کاربر شناسایی‌شده از بازدید قبلی' ELSE '' END
      || ' | دستگاه: ' || COALESCE(NEW.device_type, '-')
      || CASE WHEN NEW.device_model IS NOT NULL THEN ' (' || NEW.device_model || ')' ELSE '' END
      || ' | سیستم‌عامل: ' || COALESCE(NEW.os_name, '-')
      || CASE WHEN NEW.os_version IS NOT NULL THEN ' ' || NEW.os_version ELSE '' END
      || ' | مرورگر: ' || COALESCE(NEW.browser_name, '-')
      || ' | موقعیت: ' || COALESCE(NULLIF(concat_ws('، ', NEW.city, NEW.country), ''), '-')
      || ' | صفحه ورود: ' || COALESCE(NEW.entry_page, '-')
      || ' | آی‌پی: ' || COALESCE(host(NEW.ip_address), '-')
      || ' | بازدیدهای قبلی: ' || prev_visits
      || CASE WHEN COALESCE(NEW.is_impersonation, false) THEN ' | ورود مدیر به حساب کاربر' ELSE '' END;

  ttl := CASE
    WHEN COALESCE(NEW.is_impersonation, false) THEN 'ورود مدیر به حساب کاربر'
    WHEN COALESCE(NEW.is_logged_in, false) THEN 'ورود کاربر به سایت'
    WHEN is_returning THEN 'بازدید مهمان (کاربر ثبت‌نام‌شده شناسایی شد)'
    ELSE 'بازدید مهمان از سایت'
  END;

  INSERT INTO public.site_notifications (event_type, title, body, customer_name, customer_phone, actor_user_id, source_table, source_id)
  VALUES (
    'user_visit',
    ttl,
    bdy,
    COALESCE(uname, known_name, 'مهمان'),
    COALESCE(NEW.phone_number, uphone, known_phone),
    COALESCE(NEW.user_id, known_user_id),
    'site_sessions',
    NEW.id
  );

  RETURN NEW;
END;
$$;