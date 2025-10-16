-- اجازه ویرایش سفارشات pending و draft توسط مشتری

-- ابتدا policy قدیمی را حذف می‌کنیم
DROP POLICY IF EXISTS "Customers can update own draft projects only" ON public.projects_v3;

-- policy جدید که اجازه ویرایش draft و pending را می‌دهد
CREATE POLICY "Customers can update own draft and pending projects"
ON public.projects_v3
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM customers c
    WHERE c.id = projects_v3.customer_id 
    AND c.user_id = auth.uid()
  )
  AND status IN ('draft'::project_status_v3, 'pending'::project_status_v3)
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM customers c
    WHERE c.id = projects_v3.customer_id 
    AND c.user_id = auth.uid()
  )
  AND status IN ('draft'::project_status_v3, 'pending'::project_status_v3)
);