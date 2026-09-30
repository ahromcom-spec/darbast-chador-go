CREATE TABLE IF NOT EXISTS public.impersonation_sessions (
  session_id uuid PRIMARY KEY,
  admin_user_id uuid NOT NULL,
  target_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.impersonation_sessions TO service_role;
ALTER TABLE public.impersonation_sessions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.site_notifications
  ADD COLUMN IF NOT EXISTS actor_source text,
  ADD COLUMN IF NOT EXISTS actor_name text,
  ADD COLUMN IF NOT EXISTS impersonator_user_id uuid,
  ADD COLUMN IF NOT EXISTS impersonator_name text;

CREATE OR REPLACE FUNCTION public.classify_site_notification_actor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sid uuid;
  uid uuid := auth.uid();
  imp RECORD;
  eff uuid;
  is_staff boolean;
BEGIN
  IF NEW.actor_source IS NOT NULL THEN RETURN NEW; END IF;

  BEGIN
    sid := NULLIF(auth.jwt() ->> 'session_id', '')::uuid;
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
    NEW.actor_source := 'guest';
    eff := NULL;
  ELSE
    eff := COALESCE(uid, NEW.actor_user_id);
    IF eff IS NULL THEN
      NEW.actor_source := 'system';
    ELSE
      SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = eff AND role NOT IN ('user','contractor'))
        INTO is_staff;
      NEW.actor_source := CASE WHEN is_staff THEN 'admin' ELSE 'customer' END;
    END IF;
  END IF;

  IF eff IS NOT NULL THEN
    SELECT full_name INTO NEW.actor_name FROM public.profiles WHERE user_id = eff;
    IF NEW.actor_user_id IS NULL THEN NEW.actor_user_id := eff; END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_classify_site_notification_actor ON public.site_notifications;
CREATE TRIGGER trg_classify_site_notification_actor
BEFORE INSERT ON public.site_notifications
FOR EACH ROW EXECUTE FUNCTION public.classify_site_notification_actor();