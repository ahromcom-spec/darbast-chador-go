CREATE OR REPLACE FUNCTION public.generate_unique_customer_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_code TEXT;
  attempts INT := 0;
BEGIN
  LOOP
    new_code := LPAD(nextval('public.customer_code_seq')::text, 7, '0');

    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE customer_code = new_code
    ) AND NOT EXISTS (
      SELECT 1 FROM public.customers WHERE customer_code = new_code
    );

    attempts := attempts + 1;
    IF attempts > 1000 THEN
      RAISE EXCEPTION 'Could not generate unique sequential customer_code';
    END IF;
  END LOOP;

  RETURN new_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_customer_code_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.customer_code IS NULL OR NEW.customer_code !~ '^[0-9]{7}$' THEN
    NEW.customer_code := public.generate_unique_customer_code();
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_customer_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_code TEXT;
  existing TEXT;
  attempts INT := 0;
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    SELECT customer_code INTO existing
    FROM public.profiles
    WHERE user_id = NEW.user_id;

    IF existing IS NOT NULL AND existing ~ '^[0-9]{7}$' THEN
      NEW.customer_code := existing;
      RETURN NEW;
    END IF;
  END IF;

  IF NEW.customer_code IS NOT NULL AND NEW.customer_code ~ '^[0-9]{7}$' THEN
    RETURN NEW;
  END IF;

  LOOP
    new_code := LPAD(nextval('public.customer_code_seq')::text, 7, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.customers WHERE customer_code = new_code)
         AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE customer_code = new_code);
    attempts := attempts + 1;
    IF attempts > 1000 THEN
      RAISE EXCEPTION 'Could not generate unique sequential customer_code';
    END IF;
  END LOOP;

  NEW.customer_code := new_code;
  RETURN NEW;
END;
$$;

ALTER TABLE public.profiles
  ALTER COLUMN customer_code SET DEFAULT public.generate_unique_customer_code();