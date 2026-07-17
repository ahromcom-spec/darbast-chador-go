CREATE OR REPLACE FUNCTION public.set_customer_code_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.customer_code := public.generate_unique_customer_code();
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
  existing TEXT;
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

  NEW.customer_code := public.generate_unique_customer_code();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_customer_code_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.customer_code IS DISTINCT FROM NEW.customer_code THEN
    NEW.customer_code := OLD.customer_code;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_profiles_customer_code_update ON public.profiles;
CREATE TRIGGER prevent_profiles_customer_code_update
BEFORE UPDATE OF customer_code ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_customer_code_update();

DROP TRIGGER IF EXISTS prevent_customers_customer_code_update ON public.customers;
CREATE TRIGGER prevent_customers_customer_code_update
BEFORE UPDATE OF customer_code ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.prevent_customer_code_update();