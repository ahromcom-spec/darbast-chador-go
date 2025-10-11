-- رفع هشدارهای امنیتی: تنظیم search_path برای توابع

-- تنظیم search_path برای تابع check_max_staff_roles
DROP FUNCTION IF EXISTS public.check_max_staff_roles() CASCADE;
CREATE OR REPLACE FUNCTION public.check_max_staff_roles()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  active_count INT;
BEGIN
  IF NEW.active = true THEN
    SELECT COUNT(*) INTO active_count
    FROM public.staff_roles
    WHERE user_id = NEW.user_id AND active = true AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID);
    
    IF active_count >= 5 THEN
      RAISE EXCEPTION 'هر کاربر حداکثر می‌تواند 5 نقش فعال داشته باشد';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- بازسازی trigger
CREATE TRIGGER enforce_max_staff_roles
BEFORE INSERT OR UPDATE ON public.staff_roles
FOR EACH ROW
EXECUTE FUNCTION public.check_max_staff_roles();

-- تنظیم search_path برای تابع update_timestamp
DROP FUNCTION IF EXISTS public.update_timestamp() CASCADE;
CREATE OR REPLACE FUNCTION public.update_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- بازسازی triggers
CREATE TRIGGER update_customers_timestamp
BEFORE UPDATE ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.update_timestamp();

CREATE TRIGGER update_staff_roles_timestamp
BEFORE UPDATE ON public.staff_roles
FOR EACH ROW
EXECUTE FUNCTION public.update_timestamp();

CREATE TRIGGER update_projects_v3_timestamp
BEFORE UPDATE ON public.projects_v3
FOR EACH ROW
EXECUTE FUNCTION public.update_timestamp();