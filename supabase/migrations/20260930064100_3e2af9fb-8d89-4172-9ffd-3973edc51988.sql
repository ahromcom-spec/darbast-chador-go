CREATE OR REPLACE FUNCTION public.log_auth_event(_kind text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); pr RECORD; ttl text;
BEGIN
  IF uid IS NULL OR _kind NOT IN ('login','logout') THEN RETURN; END IF;
  ttl := CASE WHEN _kind = 'login' THEN 'ورود کاربر به حساب' ELSE 'خروج کاربر از حساب' END;
  IF EXISTS (SELECT 1 FROM public.site_notifications WHERE actor_user_id = uid AND title = ttl AND created_at > now() - interval '30 seconds') THEN RETURN; END IF;
  SELECT full_name, phone_number INTO pr FROM public.profiles WHERE user_id = uid;
  INSERT INTO public.site_notifications (event_type, title, body, customer_name, customer_phone, actor_user_id, source_table)
  VALUES (CASE WHEN _kind='login' THEN 'user_login' ELSE 'user_logout' END, ttl,
    COALESCE(pr.full_name,'کاربر') || ' ' || CASE WHEN _kind='login' THEN 'وارد حساب خود شد' ELSE 'از حساب خود خارج شد' END,
    pr.full_name, pr.phone_number, uid, 'auth');
END;
$$;
REVOKE EXECUTE ON FUNCTION public.log_auth_event(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_auth_event(text) TO authenticated;