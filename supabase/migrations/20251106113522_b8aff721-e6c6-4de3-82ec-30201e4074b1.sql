-- بروزرسانی RLS policies برای مدیران اجرایی تا هر دو نقش را پوشش دهد

-- حذف policy های قدیمی
DROP POLICY IF EXISTS "Executive managers can view approved orders" ON projects_v3;
DROP POLICY IF EXISTS "Executive managers can update execution details" ON projects_v3;
DROP POLICY IF EXISTS "Executive managers can edit pending orders" ON projects_v3;
DROP POLICY IF EXISTS "Exec can view pending awaiting their approval" ON projects_v3;

-- ایجاد policy جدید برای نمایش سفارشات approved, in_progress و completed
CREATE POLICY "Executive managers can view approved and in-progress orders"
ON projects_v3
FOR SELECT
USING (
  (
    has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR
    has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role)
  ) 
  AND 
  status IN ('approved', 'in_progress', 'completed')
);

-- ایجاد policy برای بروزرسانی جزئیات اجرا (شروع اجرا و تکمیل اجرا)
CREATE POLICY "Executive managers can update execution details"
ON projects_v3
FOR UPDATE
USING (
  (
    has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR
    has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role)
  )
  AND 
  status IN ('approved', 'in_progress', 'completed')
)
WITH CHECK (
  (
    has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR
    has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role)
  )
);

-- ایجاد policy برای ویرایش سفارشات pending (تایید یا رد)
CREATE POLICY "Executive managers can edit pending orders"
ON projects_v3
FOR UPDATE
USING (
  (
    has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR
    has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role)
  )
  AND 
  status = 'pending'
)
WITH CHECK (
  (
    has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR
    has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role)
  )
  AND 
  status IN ('pending', 'in_progress')
);

-- ایجاد policy برای نمایش سفارشات pending که منتظر تایید مدیر اجرایی هستند
CREATE POLICY "Executive managers can view pending awaiting their approval"
ON projects_v3
FOR SELECT
USING (
  (
    has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR
    has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role)
  )
  AND 
  EXISTS (
    SELECT 1
    FROM order_approvals oa
    WHERE oa.order_id = projects_v3.id
      AND oa.approved_at IS NULL
      AND (
        oa.approver_role = 'scaffold_executive_manager' OR
        oa.approver_role = 'executive_manager_scaffold_execution_with_materials'
      )
  )
);