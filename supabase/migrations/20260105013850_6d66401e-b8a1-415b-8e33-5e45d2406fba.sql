
-- Update the SELECT policy on staff_salary_settings to include daily_report module users
DROP POLICY IF EXISTS "Managers can view salary settings" ON public.staff_salary_settings;

CREATE POLICY "Managers can view salary settings" ON public.staff_salary_settings
FOR SELECT
USING (
  has_role(auth.uid(), 'admin') OR
  has_role(auth.uid(), 'ceo') OR
  has_role(auth.uid(), 'general_manager') OR
  has_role(auth.uid(), 'finance_manager') OR
  has_role(auth.uid(), 'sales_manager') OR
  has_role(auth.uid(), 'scaffold_executive_manager') OR
  has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials') OR
  has_role(auth.uid(), 'rental_executive_manager') OR
  -- Users assigned to daily_report module can also view salary settings
  EXISTS (
    SELECT 1 FROM module_assignments
    WHERE module_assignments.module_key = 'daily_report'
      AND module_assignments.is_active = true
      AND module_assignments.assigned_user_id = auth.uid()
  )
);
