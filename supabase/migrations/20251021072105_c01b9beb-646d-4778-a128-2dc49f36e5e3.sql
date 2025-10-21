-- Robust project code generation using sequence to eliminate collisions
-- 1) Ensure unique constraint on projects_v3.code
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'public.projects_v3'::regclass 
      AND contype = 'u' 
      AND conname = 'projects_v3_code_key'
  ) THEN
    ALTER TABLE public.projects_v3 ADD CONSTRAINT projects_v3_code_key UNIQUE (code);
  END IF;
END $$;

-- 2) Create sequence for project codes if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relkind = 'S' AND relname = 'project_code_seq'
  ) THEN
    CREATE SEQUENCE public.project_code_seq START WITH 1000000 INCREMENT BY 1 MINVALUE 1;
  END IF;
END $$;

-- 3) Align sequence current value with existing numeric-like codes to avoid conflicts
DO $$
DECLARE
  v_max_num BIGINT;
BEGIN
  SELECT max((regexp_replace(code, '\\D', '', 'g'))::bigint)
    INTO v_max_num
  FROM public.projects_v3
  WHERE regexp_replace(code, '\\D', '', 'g') ~ '^[0-9]+$';

  IF v_max_num IS NULL OR v_max_num < 1000000 THEN
    PERFORM setval('public.project_code_seq', 1000000, true);
  ELSE
    PERFORM setval('public.project_code_seq', v_max_num, true);
  END IF;
END $$;

-- 4) Helper: get next 7-digit code from sequence
CREATE OR REPLACE FUNCTION public.next_project_code()
RETURNS text
LANGUAGE sql
AS $$
  SELECT lpad(nextval('public.project_code_seq')::text, 7, '0');
$$;

-- 5) Safer create_project_v3: generate code via sequence (no retry loops)
CREATE OR REPLACE FUNCTION public.create_project_v3(
  _customer_id uuid,
  _province_id uuid,
  _district_id uuid,
  _subcategory_id uuid,
  _hierarchy_project_id uuid,
  _address text,
  _detailed_address text,
  _notes jsonb
)
RETURNS SETOF public.projects_v3
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_code text;
  v_user uuid;
  v_new_id uuid;
BEGIN
  -- Enforce that caller owns the customer id
  v_user := auth.uid();
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.customers c WHERE c.id = _customer_id AND c.user_id = v_user
  ) THEN
    RAISE EXCEPTION 'forbidden: customer mismatch';
  END IF;

  -- Generate collision-free code via sequence
  v_code := public.next_project_code();

  INSERT INTO public.projects_v3 (
    customer_id,
    province_id,
    district_id,
    subcategory_id,
    hierarchy_project_id,
    status,
    code,
    address,
    detailed_address,
    notes
  ) VALUES (
    _customer_id,
    _province_id,
    _district_id,
    _subcategory_id,
    _hierarchy_project_id,
    'pending',
    v_code,
    _address,
    _detailed_address,
    CASE WHEN _notes IS NULL THEN NULL ELSE _notes::text END
  )
  RETURNING id INTO v_new_id;

  RETURN QUERY SELECT * FROM public.projects_v3 WHERE id = v_new_id;
END;
$fn$;