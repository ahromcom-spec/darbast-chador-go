-- 1) Add scoping columns to customer_statements
ALTER TABLE public.customer_statements
  ADD COLUMN IF NOT EXISTS subcategory_id uuid,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS detailed_address text;

CREATE INDEX IF NOT EXISTS idx_customer_statements_scope
  ON public.customer_statements (customer_id, subcategory_id, address, status);

-- 2) Backfill existing open statements with address/subcategory from any of their orders
UPDATE public.customer_statements cs
SET subcategory_id = sub.subcategory_id,
    address = sub.address,
    detailed_address = sub.detailed_address
FROM (
  SELECT DISTINCT ON (statement_id)
    statement_id, subcategory_id, address, detailed_address
  FROM public.projects_v3
  WHERE statement_id IS NOT NULL
  ORDER BY statement_id, created_at ASC
) sub
WHERE cs.id = sub.statement_id
  AND (cs.subcategory_id IS NULL OR cs.address IS NULL);

-- 3) Replace get_or_create_open_statement to scope by (customer, subcategory, address)
CREATE OR REPLACE FUNCTION public.get_or_create_open_statement(
  _customer_id uuid,
  _subcategory_id uuid DEFAULT NULL,
  _address text DEFAULT NULL,
  _detailed_address text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
  v_next_number int;
BEGIN
  -- find an open statement that matches scope (NULL-safe equality)
  SELECT id INTO v_id
  FROM public.customer_statements
  WHERE customer_id = _customer_id
    AND status = 'open'
    AND COALESCE(subcategory_id::text,'') = COALESCE(_subcategory_id::text,'')
    AND COALESCE(address,'') = COALESCE(_address,'')
  ORDER BY statement_number DESC
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  SELECT COALESCE(MAX(statement_number), 0) + 1 INTO v_next_number
  FROM public.customer_statements
  WHERE customer_id = _customer_id;

  INSERT INTO public.customer_statements (
    customer_id, statement_number, status, subcategory_id, address, detailed_address
  ) VALUES (
    _customer_id, v_next_number, 'open', _subcategory_id, _address, _detailed_address
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

-- 4) Update trigger to pass scope and to switch statement when scope changes
CREATE OR REPLACE FUNCTION public.trigger_assign_order_statement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_statement_id uuid;
  v_eligible boolean;
  v_current_scope_subcat uuid;
  v_current_scope_addr text;
BEGIN
  v_eligible := NEW.customer_id IS NOT NULL
                AND COALESCE(NEW.status::text, '') <> 'rejected'
                AND COALESCE(NEW.is_archived, false) = false
                AND COALESCE(NEW.is_deep_archived, false) = false;

  IF NOT v_eligible THEN
    RETURN NEW;
  END IF;

  -- if already attached to a statement, check that scope still matches; otherwise reassign
  IF NEW.statement_id IS NOT NULL THEN
    SELECT subcategory_id, address INTO v_current_scope_subcat, v_current_scope_addr
    FROM public.customer_statements WHERE id = NEW.statement_id;

    IF COALESCE(v_current_scope_subcat::text,'') = COALESCE(NEW.subcategory_id::text,'')
       AND COALESCE(v_current_scope_addr,'') = COALESCE(NEW.address,'') THEN
      RETURN NEW; -- still matches
    END IF;
  END IF;

  v_statement_id := public.get_or_create_open_statement(
    NEW.customer_id, NEW.subcategory_id, NEW.address, NEW.detailed_address
  );
  NEW.statement_id := v_statement_id;

  RETURN NEW;
END;
$function$;

-- ensure UPDATE also re-evaluates when address or subcategory changes
DROP TRIGGER IF EXISTS assign_order_statement_trg ON public.projects_v3;
CREATE TRIGGER assign_order_statement_trg
BEFORE INSERT OR UPDATE OF customer_id, subcategory_id, address, detailed_address, status, is_archived, is_deep_archived, statement_id
ON public.projects_v3
FOR EACH ROW EXECUTE FUNCTION public.trigger_assign_order_statement();

-- 5) Re-bucket existing eligible orders so they sit in the correct scoped statement
DO $$
DECLARE r record; v_sid uuid;
BEGIN
  FOR r IN
    SELECT id, customer_id, subcategory_id, address, detailed_address
    FROM public.projects_v3
    WHERE customer_id IS NOT NULL
      AND COALESCE(status::text,'') <> 'rejected'
      AND COALESCE(is_archived,false) = false
      AND COALESCE(is_deep_archived,false) = false
    ORDER BY created_at ASC
  LOOP
    v_sid := public.get_or_create_open_statement(r.customer_id, r.subcategory_id, r.address, r.detailed_address);
    UPDATE public.projects_v3 SET statement_id = v_sid WHERE id = r.id AND (statement_id IS DISTINCT FROM v_sid);
  END LOOP;
END $$;

-- 6) Cleanup empty statements (no orders, status open) that are now orphaned
DELETE FROM public.customer_statements cs
WHERE cs.status = 'open'
  AND NOT EXISTS (SELECT 1 FROM public.projects_v3 p WHERE p.statement_id = cs.id);
