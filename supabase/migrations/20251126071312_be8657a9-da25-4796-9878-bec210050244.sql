-- اجازه به کاربران برای لغو (reject) سفارشات pending خودشان
DROP POLICY IF EXISTS "Users can cancel their own pending orders" ON public.projects_v3;

CREATE POLICY "Users can cancel their own pending orders"
ON public.projects_v3
FOR UPDATE
TO authenticated
USING (
  customer_id IN (
    SELECT id FROM public.customers WHERE user_id = auth.uid()
  )
  AND status = 'pending'
)
WITH CHECK (
  customer_id IN (
    SELECT id FROM public.customers WHERE user_id = auth.uid()
  )
  AND status = 'rejected'
  AND rejection_reason IS NOT NULL
);