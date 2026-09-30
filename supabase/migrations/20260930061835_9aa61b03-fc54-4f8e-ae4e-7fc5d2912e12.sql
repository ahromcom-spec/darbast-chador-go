CREATE OR REPLACE FUNCTION public.classify_site_notification_actor()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  sid uuid; uid uuid := auth.uid(); imp RECORD; eff uuid; is_admin boolean;
BEGIN
  IF NEW.actor_source IS NOT NULL THEN RETURN NEW; END IF;
  BEGIN sid := NULLIF(auth.jwt() ->> 'session_id', '')::uuid;
  EXCEPTION WHEN others THEN sid := NULL; END;
  IF sid IS NOT NULL THEN
    SELECT * INTO imp FROM public.impersonation_sessions WHERE session_id = sid;
  END IF;
  IF imp.session_id IS NOT NULL OR NEW.title LIKE 'ورود مدیر به حساب%' THEN
    NEW.actor_source := 'impersonation';
    NEW.impersonator_user_id := imp.admin_user_id;
    IF imp.admin_user_id IS NOT NULL THEN
      SELECT full_name INTO NEW.impersonator_name FROM public.profiles WHERE user_id = imp.admin_user_id;
    END IF;
    eff := COALESCE(uid, NEW.actor_user_id);
  ELSIF NEW.event_type = 'user_visit' AND (NEW.actor_user_id IS NULL OR NEW.title LIKE 'بازدید مهمان%') THEN
    NEW.actor_source := 'guest'; eff := NULL;
  ELSE
    eff := COALESCE(uid, NEW.actor_user_id);
    IF eff IS NULL THEN NEW.actor_source := 'system';
    ELSE
      SELECT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = eff AND phone_number = '09125511494') INTO is_admin;
      NEW.actor_source := CASE WHEN is_admin THEN 'admin' ELSE 'customer' END;
    END IF;
  END IF;
  IF eff IS NOT NULL THEN
    SELECT full_name INTO NEW.actor_name FROM public.profiles WHERE user_id = eff;
    IF NEW.actor_user_id IS NULL THEN NEW.actor_user_id := eff; END IF;
  END IF;
  RETURN NEW;
END;
$function$;

UPDATE public.site_notifications s SET actor_source = 'customer'
WHERE actor_source = 'admin' AND actor_user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = s.actor_user_id AND p.phone_number = '09125511494');