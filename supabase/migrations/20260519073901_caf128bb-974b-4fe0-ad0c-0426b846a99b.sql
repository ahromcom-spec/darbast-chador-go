ALTER TABLE public.profiles
  ALTER COLUMN customer_code DROP DEFAULT;

SELECT setval(
  'public.customer_code_seq',
  GREATEST(
    COALESCE((SELECT MAX(customer_code::bigint) FROM public.profiles WHERE customer_code ~ '^[0-9]{7}$'), 2002000),
    COALESCE((SELECT MAX(customer_code::bigint) FROM public.customers WHERE customer_code ~ '^[0-9]{7}$'), 2002000),
    2002000
  ) + 1,
  false
);