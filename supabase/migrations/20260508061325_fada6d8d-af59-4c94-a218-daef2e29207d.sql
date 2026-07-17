-- Add unique 6-digit customer_code to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS customer_code TEXT;

CREATE OR REPLACE FUNCTION public.generate_unique_customer_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_code TEXT;
  exists_check BOOLEAN;
  attempt INT := 0;
BEGIN
  LOOP
    new_code := LPAD(FLOOR(RANDOM() * 900000 + 100000)::TEXT, 6, '0');
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE customer_code = new_code) INTO exists_check;
    IF NOT exists_check THEN
      RETURN new_code;
    END IF;
    attempt := attempt + 1;
    IF attempt > 100 THEN
      RAISE EXCEPTION 'Could not generate unique customer_code';
    END IF;
  END LOOP;
END;
$$;

-- Backfill existing rows
UPDATE public.profiles
SET customer_code = public.generate_unique_customer_code()
WHERE customer_code IS NULL;

-- Make NOT NULL + UNIQUE
ALTER TABLE public.profiles ALTER COLUMN customer_code SET NOT NULL;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_customer_code_key UNIQUE (customer_code);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_customer_code_format CHECK (customer_code ~ '^[0-9]{6}$');

-- Trigger to auto-set on insert
CREATE OR REPLACE FUNCTION public.set_customer_code_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.customer_code IS NULL THEN
    NEW.customer_code := public.generate_unique_customer_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_customer_code ON public.profiles;
CREATE TRIGGER trg_set_customer_code
BEFORE INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_customer_code_on_insert();