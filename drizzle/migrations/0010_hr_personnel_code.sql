ALTER TABLE public.hr_employees ADD COLUMN IF NOT EXISTS personnel_code text;

CREATE UNIQUE INDEX IF NOT EXISTS hr_employees_personnel_code_key ON public.hr_employees (personnel_code) WHERE personnel_code IS NOT NULL;

ALTER TABLE public.hr_employees DROP CONSTRAINT IF EXISTS hr_employees_personnel_code_format;
ALTER TABLE public.hr_employees ADD CONSTRAINT hr_employees_personnel_code_format CHECK (personnel_code IS NULL OR personnel_code ~ '^[1-9][0-9]{7}$');

CREATE OR REPLACE FUNCTION public.generate_unique_personnel_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
BEGIN
  LOOP
    v_code := (10000000 + floor(random() * 90000000))::bigint::text;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.hr_employees WHERE personnel_code = v_code)
      AND NOT EXISTS (SELECT 1 FROM public.staff_salary_settings WHERE staff_code = v_code);
  END LOOP;
  RETURN v_code;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_unique_personnel_code() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.assign_hr_personnel_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.personnel_code IS NOT NULL THEN
    -- A personnel code is permanent once issued
    NEW.personnel_code := OLD.personnel_code;
  ELSIF NEW.personnel_code IS NULL AND COALESCE(btrim(NEW.phone_number), '') = '' THEN
    NEW.personnel_code := public.generate_unique_personnel_code();
  ELSIF TG_OP = 'INSERT' THEN
    NEW.personnel_code := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_hr_personnel_code ON public.hr_employees;
CREATE TRIGGER trg_assign_hr_personnel_code
BEFORE INSERT OR UPDATE ON public.hr_employees
FOR EACH ROW EXECUTE FUNCTION public.assign_hr_personnel_code();

-- Backfill: issue codes to existing staff without a phone number
UPDATE public.hr_employees
SET personnel_code = public.generate_unique_personnel_code()
WHERE personnel_code IS NULL AND COALESCE(btrim(phone_number), '') = '';