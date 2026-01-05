-- Drop and recreate the SELECT policy to include daily_report module users
DROP POLICY IF EXISTS "HR employees readable by module users" ON public.hr_employees;

CREATE POLICY "HR employees readable by module users" ON public.hr_employees
FOR SELECT
USING (
  has_role(auth.uid(), 'ceo') OR
  has_role(auth.uid(), 'general_manager') OR
  -- Users assigned to hr_management module
  EXISTS (
    SELECT 1 FROM module_assignments
    WHERE module_assignments.module_key = 'hr_management'
      AND module_assignments.is_active = true
      AND module_assignments.assigned_user_id = auth.uid()
  ) OR
  -- Users assigned to daily_report module can also read HR employees
  EXISTS (
    SELECT 1 FROM module_assignments
    WHERE module_assignments.module_key = 'daily_report'
      AND module_assignments.is_active = true
      AND module_assignments.assigned_user_id = auth.uid()
  ) OR
  -- Users can view their own HR record
  auth.uid() = user_id
);