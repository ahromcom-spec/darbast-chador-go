-- When a staff member's report identifier changes between personnel code and phone,
-- carry their past daily-report rows and salary settings over to the new identifier.
CREATE OR REPLACE FUNCTION public.sync_hr_staff_code_references()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  old_code text := COALESCE(NULLIF(btrim(OLD.phone_number), ''), NULLIF(btrim(OLD.personnel_code), ''));
  new_code text := COALESCE(NULLIF(btrim(NEW.phone_number), ''), NULLIF(btrim(NEW.personnel_code), ''));
BEGIN
  IF old_code IS NULL OR new_code IS NULL OR old_code = new_code THEN
    RETURN NEW;
  END IF;
  -- Only switches to or from a personnel code are migrated
  IF NOT (old_code = NULLIF(btrim(OLD.personnel_code), '') OR new_code = NULLIF(btrim(NEW.personnel_code), '')) THEN
    RETURN NEW;
  END IF;

  UPDATE public.daily_report_staff
     SET staff_name = new_code || substr(staff_name, length(old_code) + 1)
   WHERE staff_name LIKE old_code || ' - %';

  UPDATE public.staff_salary_settings
     SET staff_code = new_code
   WHERE staff_code = old_code;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_hr_staff_code_references() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sync_hr_staff_code_references ON public.hr_employees;
CREATE TRIGGER trg_sync_hr_staff_code_references
AFTER UPDATE OF phone_number, personnel_code ON public.hr_employees
FOR EACH ROW EXECUTE FUNCTION public.sync_hr_staff_code_references();