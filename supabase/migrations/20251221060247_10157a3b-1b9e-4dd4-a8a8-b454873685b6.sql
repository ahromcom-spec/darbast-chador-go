-- Fix RLS for staff_salary_settings so roles that can access the daily report module can also manage salary settings

-- Ensure created_by is auto-populated for authenticated users (frontend still sets it explicitly)
ALTER TABLE public.staff_salary_settings
ALTER COLUMN created_by SET DEFAULT auth.uid();

-- Replace existing policies with expanded role set + authenticated-only
DROP POLICY IF EXISTS "CEO and managers can view all salary settings" ON public.staff_salary_settings;
DROP POLICY IF EXISTS "CEO and managers can insert salary settings" ON public.staff_salary_settings;
DROP POLICY IF EXISTS "CEO and managers can update salary settings" ON public.staff_salary_settings;
DROP POLICY IF EXISTS "CEO and managers can delete salary settings" ON public.staff_salary_settings;

CREATE POLICY "Managers can view salary settings"
ON public.staff_salary_settings
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'ceo'::app_role)
  OR public.has_role(auth.uid(), 'general_manager'::app_role)
  OR public.has_role(auth.uid(), 'finance_manager'::app_role)
  OR public.has_role(auth.uid(), 'sales_manager'::app_role)
  OR public.has_role(auth.uid(), 'scaffold_executive_manager'::app_role)
  OR public.has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role)
  OR public.has_role(auth.uid(), 'rental_executive_manager'::app_role)
);

CREATE POLICY "Managers can insert salary settings"
ON public.staff_salary_settings
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'ceo'::app_role)
    OR public.has_role(auth.uid(), 'general_manager'::app_role)
    OR public.has_role(auth.uid(), 'finance_manager'::app_role)
    OR public.has_role(auth.uid(), 'sales_manager'::app_role)
    OR public.has_role(auth.uid(), 'scaffold_executive_manager'::app_role)
    OR public.has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role)
    OR public.has_role(auth.uid(), 'rental_executive_manager'::app_role)
  )
);

CREATE POLICY "Managers can update salary settings"
ON public.staff_salary_settings
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'ceo'::app_role)
  OR public.has_role(auth.uid(), 'general_manager'::app_role)
  OR public.has_role(auth.uid(), 'finance_manager'::app_role)
  OR public.has_role(auth.uid(), 'sales_manager'::app_role)
  OR public.has_role(auth.uid(), 'scaffold_executive_manager'::app_role)
  OR public.has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role)
  OR public.has_role(auth.uid(), 'rental_executive_manager'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'ceo'::app_role)
  OR public.has_role(auth.uid(), 'general_manager'::app_role)
  OR public.has_role(auth.uid(), 'finance_manager'::app_role)
  OR public.has_role(auth.uid(), 'sales_manager'::app_role)
  OR public.has_role(auth.uid(), 'scaffold_executive_manager'::app_role)
  OR public.has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role)
  OR public.has_role(auth.uid(), 'rental_executive_manager'::app_role)
);

CREATE POLICY "Managers can delete salary settings"
ON public.staff_salary_settings
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'ceo'::app_role)
  OR public.has_role(auth.uid(), 'general_manager'::app_role)
  OR public.has_role(auth.uid(), 'finance_manager'::app_role)
  OR public.has_role(auth.uid(), 'sales_manager'::app_role)
  OR public.has_role(auth.uid(), 'scaffold_executive_manager'::app_role)
  OR public.has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role)
  OR public.has_role(auth.uid(), 'rental_executive_manager'::app_role)
);
