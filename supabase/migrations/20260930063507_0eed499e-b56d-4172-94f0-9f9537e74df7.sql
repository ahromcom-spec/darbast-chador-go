CREATE OR REPLACE FUNCTION public.classify_site_notification_actor()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  sid uuid; uid uuid := auth.uid(); imp_sid uuid; imp_admin uuid; eff uuid; is_admin boolean;
BEGIN
  IF NEW.actor_source IS NOT NULL THEN RETURN NEW; END IF;
  BEGIN sid := NULLIF(auth.jwt() ->> 'session_id', '')::uuid;
  EXCEPTION WHEN others THEN sid := NULL; END;
  IF sid IS NOT NULL THEN
    SELECT session_id, admin_user_id INTO imp_sid, imp_admin FROM public.impersonation_sessions WHERE session_id = sid;
  END IF;
  IF imp_sid IS NOT NULL OR NEW.title LIKE 'ورود مدیر به حساب%' THEN
    NEW.actor_source := 'impersonation';
    NEW.impersonator_user_id := imp_admin;
    IF imp_admin IS NOT NULL THEN
      SELECT full_name INTO NEW.impersonator_name FROM public.profiles WHERE user_id = imp_admin;
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
$$;

CREATE OR REPLACE FUNCTION public.notify_site_assistant_question()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pr RECORD;
BEGIN
  IF NEW.role <> 'user' THEN RETURN NEW; END IF;
  SELECT full_name, phone_number INTO pr FROM public.profiles WHERE user_id = NEW.user_id;
  INSERT INTO public.site_notifications (event_type, title, body, customer_name, customer_phone, actor_user_id, source_table, source_id)
  VALUES ('assistant_question', 'سوال از دستیار اهرم', left(NEW.content, 500), pr.full_name, pr.phone_number, NEW.user_id, 'assistant_chat_messages', NEW.id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_notify_site_assistant_question ON public.assistant_chat_messages;
CREATE TRIGGER trg_notify_site_assistant_question AFTER INSERT ON public.assistant_chat_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_site_assistant_question();
INSERT INTO public.site_notifications (event_type, title, body, customer_name, customer_phone, actor_user_id, source_table, source_id, created_at)
SELECT 'assistant_question', 'سوال از دستیار اهرم', left(m.content,500), p.full_name, p.phone_number, m.user_id, 'assistant_chat_messages', m.id, m.created_at
FROM public.assistant_chat_messages m LEFT JOIN public.profiles p ON p.user_id=m.user_id
WHERE m.role='user' AND m.created_at > now() - interval '1 day';