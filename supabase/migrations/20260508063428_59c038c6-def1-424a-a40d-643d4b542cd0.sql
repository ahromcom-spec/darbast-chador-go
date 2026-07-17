
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_customer_code_format;
ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_customer_code_check;

-- Resequence profiles by created_at ascending (profiles has 64 rows, treat it as the source for users)
WITH ordered AS (
  SELECT user_id, ROW_NUMBER() OVER (ORDER BY created_at ASC, user_id ASC) AS rn
  FROM public.profiles
)
UPDATE public.profiles p
SET customer_code = LPAD((2000000 + o.rn)::text, 7, '0')
FROM ordered o
WHERE p.user_id = o.user_id;

-- Sync customers from profiles via user_id
UPDATE public.customers c
SET customer_code = p.customer_code
FROM public.profiles p
WHERE c.user_id = p.user_id;

-- Any customers without a matching profile: assign new sequential codes
DO $$
DECLARE
  rec RECORD;
  next_num BIGINT;
BEGIN
  SELECT COALESCE(MAX(customer_code::bigint), 2000000) INTO next_num FROM public.profiles WHERE customer_code ~ '^[0-9]+$';
  FOR rec IN SELECT id FROM public.customers WHERE customer_code IS NULL OR customer_code !~ '^[0-9]{7}$' ORDER BY created_at ASC LOOP
    next_num := next_num + 1;
    UPDATE public.customers SET customer_code = LPAD(next_num::text, 7, '0') WHERE id = rec.id;
  END LOOP;
END $$;

ALTER TABLE public.customers
  ADD CONSTRAINT customers_customer_code_check CHECK (customer_code ~ '^[0-9]{7}$');

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_customer_code_format CHECK (customer_code IS NULL OR customer_code ~ '^[0-9]{7}$');

DROP SEQUENCE IF EXISTS public.customer_code_seq;
DO $$
DECLARE
  max_val BIGINT;
BEGIN
  SELECT GREATEST(
    COALESCE((SELECT MAX(customer_code::bigint) FROM public.customers WHERE customer_code ~ '^[0-9]+$'), 2000000),
    COALESCE((SELECT MAX(customer_code::bigint) FROM public.profiles WHERE customer_code ~ '^[0-9]+$'), 2000000)
  ) INTO max_val;
  EXECUTE format('CREATE SEQUENCE public.customer_code_seq MINVALUE 2000001 START WITH %s', max_val + 1);
END $$;

CREATE OR REPLACE FUNCTION public.assign_customer_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_code TEXT;
  existing TEXT;
  attempts INT := 0;
BEGIN
  IF NEW.customer_code IS NOT NULL AND NEW.customer_code ~ '^[0-9]{7}$' THEN
    RETURN NEW;
  END IF;

  -- Reuse profile's customer_code if exists
  IF NEW.user_id IS NOT NULL THEN
    SELECT customer_code INTO existing FROM public.profiles WHERE user_id = NEW.user_id;
    IF existing IS NOT NULL AND existing ~ '^[0-9]{7}$' THEN
      NEW.customer_code := existing;
      RETURN NEW;
    END IF;
  END IF;

  LOOP
    new_code := LPAD(nextval('public.customer_code_seq')::text, 7, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.customers WHERE customer_code = new_code)
         AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE customer_code = new_code);
    attempts := attempts + 1;
    IF attempts > 50 THEN
      RAISE EXCEPTION 'Could not generate unique customer_code';
    END IF;
  END LOOP;

  NEW.customer_code := new_code;
  RETURN NEW;
END;
$$;
