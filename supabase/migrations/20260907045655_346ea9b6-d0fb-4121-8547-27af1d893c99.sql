ALTER TABLE public.customer_statements
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_deep_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_customer_statements_archive
  ON public.customer_statements (is_archived, is_deep_archived);

CREATE OR REPLACE FUNCTION public.get_or_create_open_statement(
  _customer_id uuid,
  _subcategory_id uuid DEFAULT NULL,
  _address text DEFAULT NULL,
  _detailed_address text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_next_number int;
BEGIN
  SELECT id INTO v_id
  FROM public.customer_statements
  WHERE customer_id = _customer_id
    AND status = 'open'
    AND is_archived = false
    AND is_deep_archived = false
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
$$;

CREATE OR REPLACE FUNCTION public.get_or_create_open_statement(_customer_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_next_number int;
BEGIN
  SELECT id INTO v_id
  FROM public.customer_statements
  WHERE customer_id = _customer_id
    AND status = 'open'
    AND is_archived = false
    AND is_deep_archived = false
  ORDER BY statement_number DESC
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  SELECT COALESCE(MAX(statement_number), 0) + 1 INTO v_next_number
  FROM public.customer_statements
  WHERE customer_id = _customer_id;

  INSERT INTO public.customer_statements (customer_id, statement_number, status)
  VALUES (_customer_id, v_next_number, 'open')
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;