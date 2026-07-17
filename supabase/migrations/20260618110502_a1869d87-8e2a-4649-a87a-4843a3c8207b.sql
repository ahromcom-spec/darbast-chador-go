
DELETE FROM public.order_payments
WHERE id = '69d4021f-9a75-4700-826a-c86d45888a91';

UPDATE public.cheques
SET order_payment_ids = '{}',
    transaction_id = NULL,
    updated_at = now()
WHERE id = '9eb2c8b9-9c3b-41ee-b494-9e0fc347fe7a';

WITH sums AS (
  SELECT p.id AS order_id,
         COALESCE((SELECT SUM(amount) FROM public.order_payments op WHERE op.order_id = p.id), 0) AS s
  FROM public.projects_v3 p
  WHERE p.id IN (
    '41dc1628-8db0-4831-91d5-7b24f670e75e',
    '8874e610-8d89-4c19-b84a-20ecb77ca9ee'
  )
)
UPDATE public.projects_v3 p
SET total_paid = sums.s,
    payment_confirmed_at = CASE
      WHEN COALESCE(p.total_price, p.payment_amount, 0) > 0
       AND sums.s >= COALESCE(p.total_price, p.payment_amount, 0)
      THEN COALESCE(p.payment_confirmed_at, now())
      ELSE NULL
    END,
    status = CASE
      WHEN COALESCE(p.total_price, p.payment_amount, 0) > 0
       AND sums.s >= COALESCE(p.total_price, p.payment_amount, 0)
       AND p.status NOT IN ('closed','paid')
      THEN 'paid'::project_status_v3
      WHEN p.status = 'paid'
       AND sums.s < COALESCE(p.total_price, p.payment_amount, 0)
      THEN 'pending'::project_status_v3
      ELSE p.status
    END,
    updated_at = now()
FROM sums
WHERE p.id = sums.order_id;
