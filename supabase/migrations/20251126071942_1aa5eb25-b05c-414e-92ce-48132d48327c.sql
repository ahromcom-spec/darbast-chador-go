-- اجازه به کاربران برای حذف سفارشات رد شده خودشان
CREATE POLICY "Users can delete their rejected orders"
ON public.projects_v3
FOR DELETE
TO authenticated
USING (
  customer_id IN (
    SELECT id FROM public.customers WHERE user_id = auth.uid()
  )
  AND status = 'rejected'
);