-- بروزرسانی RLS policy برای اجازه ویرایش کامل سفارش توسط CEO

DROP POLICY IF EXISTS "CEO can approve or reject pending orders" ON public.projects_v3;

-- اجازه به CEO برای تغییر هر فیلد از سفارشات pending (شامل ویرایش قبل از تایید)
CREATE POLICY "CEO can edit and approve pending orders"
ON public.projects_v3
FOR UPDATE
USING (
  has_role(auth.uid(), 'ceo'::app_role)
  AND status = 'pending'::project_status_v3
)
WITH CHECK (
  has_role(auth.uid(), 'ceo'::app_role)
  AND (
    -- اجازه تایید/رد
    (status IN ('approved'::project_status_v3, 'rejected'::project_status_v3) AND approved_by = auth.uid())
    OR
    -- یا ویرایش در حالت pending
    (status = 'pending'::project_status_v3)
  )
);