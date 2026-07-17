
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_customer_code_format;
ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_customer_code_format;

-- Move to temporary unique range first
WITH ordered AS (
  SELECT user_id, ROW_NUMBER() OVER (ORDER BY created_at ASC, user_id ASC) AS rn
  FROM public.profiles
  WHERE customer_code IS NOT NULL
)
UPDATE public.profiles p
SET customer_code = 'TMP' || o.rn::text
FROM ordered o
WHERE p.user_id = o.user_id;

-- Final 7-digit codes starting at 2002001
WITH ordered AS (
  SELECT user_id, ROW_NUMBER() OVER (ORDER BY created_at ASC, user_id ASC) AS rn
  FROM public.profiles
  WHERE customer_code IS NOT NULL
)
UPDATE public.profiles p
SET customer_code = LPAD((2002000 + o.rn)::text, 7, '0')
FROM ordered o
WHERE p.user_id = o.user_id;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_customer_code_format CHECK (customer_code ~ '^[0-9]{7}$');

-- Sync customers from profiles via user_id
UPDATE public.customers c
SET customer_code = NULL
WHERE customer_code IS NOT NULL;

UPDATE public.customers c
SET customer_code = p.customer_code
FROM public.profiles p
WHERE c.user_id = p.user_id AND p.customer_code IS NOT NULL;

ALTER TABLE public.customers
  ADD CONSTRAINT customers_customer_code_format CHECK (customer_code IS NULL OR customer_code ~ '^[0-9]{7}$');

-- Continue sequence from next available value
SELECT setval(
  'public.customer_code_seq',
  GREATEST(
    COALESCE((SELECT MAX(customer_code::bigint) FROM public.profiles WHERE customer_code ~ '^[0-9]{7}$'), 2002000),
    2002000
  ) + 1,
  false
);
