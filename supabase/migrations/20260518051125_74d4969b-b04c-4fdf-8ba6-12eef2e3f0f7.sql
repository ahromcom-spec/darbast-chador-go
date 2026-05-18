CREATE OR REPLACE FUNCTION public.generate_unique_customer_code()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  new_code TEXT;
  exists_check BOOLEAN;
  attempt INT := 0;
BEGIN
  LOOP
    -- 7-digit code to match profiles_customer_code_format check (^[0-9]{7}$)
    new_code := LPAD(FLOOR(RANDOM() * 9000000 + 1000000)::TEXT, 7, '0');
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