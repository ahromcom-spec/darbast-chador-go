-- حذف policy قدیمی
DROP POLICY IF EXISTS "CEO can approve/reject orders" ON public.projects_v3;

-- ایجاد policy جدید که به CEO اجازه می‌دهد تمام فیلدهای مرتبط با تایید/رد را تغییر دهد
CREATE POLICY "CEO can approve or reject pending orders"
ON public.projects_v3
FOR UPDATE
USING (
  has_role(auth.uid(), 'ceo'::app_role) 
  AND status = 'pending'::project_status_v3
)
WITH CHECK (
  has_role(auth.uid(), 'ceo'::app_role) 
  AND status IN ('approved'::project_status_v3, 'rejected'::project_status_v3)
  AND approved_by = auth.uid()
);