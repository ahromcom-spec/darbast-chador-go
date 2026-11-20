ALTER TABLE public.sms_custom_variables
  ADD COLUMN IF NOT EXISTS legacy_token text,
  ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 1000;

CREATE UNIQUE INDEX IF NOT EXISTS sms_custom_variables_legacy_token_key
  ON public.sms_custom_variables (legacy_token) WHERE legacy_token IS NOT NULL;

-- المان‌های پایه سایت قابل ویرایش‌اند ولی حذف نمی‌شوند و نشان پایه/نام قدیمی‌شان از برنامه تغییر نمی‌کند
CREATE OR REPLACE FUNCTION public.protect_sms_system_elements()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_system AND current_user NOT IN ('postgres', 'supabase_admin') THEN
      RAISE EXCEPTION 'المان‌های پایه سایت حذف نمی‌شوند؛ می‌توانید آن را غیرفعال یا ویرایش کنید';
    END IF;
    RETURN OLD;
  END IF;
  IF current_user NOT IN ('postgres', 'supabase_admin') THEN
    IF TG_OP = 'UPDATE' THEN
      NEW.is_system := OLD.is_system;
      NEW.legacy_token := OLD.legacy_token;
    ELSE
      NEW.is_system := false;
      NEW.legacy_token := NULL;
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_sms_system_elements ON public.sms_custom_variables;
CREATE TRIGGER protect_sms_system_elements
  BEFORE INSERT OR UPDATE OR DELETE ON public.sms_custom_variables
  FOR EACH ROW EXECUTE FUNCTION public.protect_sms_system_elements();