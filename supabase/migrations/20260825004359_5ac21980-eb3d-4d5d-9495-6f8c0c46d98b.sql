-- 1) sync snapshot on projects_v3 when customer_id changes (order transfer)
CREATE OR REPLACE FUNCTION public.sync_project_customer_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_phone text;
BEGIN
  IF NEW.customer_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT p.full_name, p.phone_number
  INTO v_name, v_phone
  FROM public.customers c
  JOIN public.profiles p ON p.user_id = c.user_id
  WHERE c.id = NEW.customer_id;

  IF v_name IS NOT NULL THEN
    NEW.customer_name := v_name;
  END IF;
  IF v_phone IS NOT NULL THEN
    NEW.customer_phone := v_phone;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_project_customer_snapshot ON public.projects_v3;
CREATE TRIGGER trg_sync_project_customer_snapshot
BEFORE INSERT OR UPDATE OF customer_id ON public.projects_v3
FOR EACH ROW EXECUTE FUNCTION public.sync_project_customer_snapshot();

-- 2) cascade profile name/phone edits to existing orders
CREATE OR REPLACE FUNCTION public.cascade_profile_to_projects_v3()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.projects_v3 pv
  SET customer_name = COALESCE(NEW.full_name, pv.customer_name),
      customer_phone = COALESCE(NEW.phone_number, pv.customer_phone)
  FROM public.customers c
  WHERE c.id = pv.customer_id
    AND c.user_id = NEW.user_id
    AND (pv.customer_name IS DISTINCT FROM COALESCE(NEW.full_name, pv.customer_name)
      OR pv.customer_phone IS DISTINCT FROM COALESCE(NEW.phone_number, pv.customer_phone));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cascade_profile_to_projects_v3 ON public.profiles;
CREATE TRIGGER trg_cascade_profile_to_projects_v3
AFTER UPDATE OF full_name, phone_number ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.cascade_profile_to_projects_v3();

-- 3) backfill stale snapshots
UPDATE public.projects_v3 pv
SET customer_name = COALESCE(p.full_name, pv.customer_name),
    customer_phone = COALESCE(p.phone_number, pv.customer_phone)
FROM public.customers c
JOIN public.profiles p ON p.user_id = c.user_id
WHERE c.id = pv.customer_id
  AND (pv.customer_name IS DISTINCT FROM COALESCE(p.full_name, pv.customer_name)
    OR pv.customer_phone IS DISTINCT FROM COALESCE(p.phone_number, pv.customer_phone));