-- Drop existing restrictive delete policy
DROP POLICY IF EXISTS "Managers can delete any daily report" ON public.daily_reports;
DROP POLICY IF EXISTS "Creators can delete their own daily reports" ON public.daily_reports;
DROP POLICY IF EXISTS "Allow delete for authorized roles" ON public.daily_reports;

-- Create new comprehensive delete policy for managers
CREATE POLICY "Managers can delete any daily report" ON public.daily_reports
FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'ceo'::app_role) OR
  public.has_role(auth.uid(), 'general_manager'::app_role) OR
  public.has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR
  public.has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role) OR
  created_by = auth.uid()
);

-- Also fix daily_report_orders delete policy
DROP POLICY IF EXISTS "Managers can delete any daily report order" ON public.daily_report_orders;
DROP POLICY IF EXISTS "Allow delete for authorized roles" ON public.daily_report_orders;

CREATE POLICY "Managers can delete any daily report order" ON public.daily_report_orders
FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'ceo'::app_role) OR
  public.has_role(auth.uid(), 'general_manager'::app_role) OR
  public.has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR
  public.has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role)
);

-- Also fix daily_report_staff delete policy
DROP POLICY IF EXISTS "Managers can delete any daily report staff" ON public.daily_report_staff;
DROP POLICY IF EXISTS "Allow delete for authorized roles" ON public.daily_report_staff;

CREATE POLICY "Managers can delete any daily report staff" ON public.daily_report_staff
FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'ceo'::app_role) OR
  public.has_role(auth.uid(), 'general_manager'::app_role) OR
  public.has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR
  public.has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role)
);