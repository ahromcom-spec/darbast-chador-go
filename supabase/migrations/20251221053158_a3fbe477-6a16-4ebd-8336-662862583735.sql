-- Update RLS policies for staff_salary_settings to also allow admins

-- SELECT
DROP POLICY IF EXISTS "CEO and managers can view all salary settings" ON public.staff_salary_settings;
CREATE POLICY "CEO and managers can view all salary settings"
  ON public.staff_salary_settings
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'ceo'::app_role) OR
    has_role(auth.uid(), 'general_manager'::app_role) OR
    has_role(auth.uid(), 'finance_manager'::app_role)
  );

-- INSERT
DROP POLICY IF EXISTS "CEO and managers can insert salary settings" ON public.staff_salary_settings;
CREATE POLICY "CEO and managers can insert salary settings"
  ON public.staff_salary_settings
  FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'ceo'::app_role) OR
    has_role(auth.uid(), 'general_manager'::app_role) OR
    has_role(auth.uid(), 'finance_manager'::app_role)
  );

-- UPDATE
DROP POLICY IF EXISTS "CEO and managers can update salary settings" ON public.staff_salary_settings;
CREATE POLICY "CEO and managers can update salary settings"
  ON public.staff_salary_settings
  FOR UPDATE
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'ceo'::app_role) OR
    has_role(auth.uid(), 'general_manager'::app_role) OR
    has_role(auth.uid(), 'finance_manager'::app_role)
  );

-- DELETE
DROP POLICY IF EXISTS "CEO and managers can delete salary settings" ON public.staff_salary_settings;
CREATE POLICY "CEO and managers can delete salary settings"
  ON public.staff_salary_settings
  FOR DELETE
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'ceo'::app_role) OR
    has_role(auth.uid(), 'general_manager'::app_role) OR
    has_role(auth.uid(), 'finance_manager'::app_role)
  );
