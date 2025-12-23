-- Fix RLS so staff can see their own work records (and keep managers access)

-- daily_report_staff: remove unsafe/ineffective policy and add explicit rules
DROP POLICY IF EXISTS "Users can view staff reports they have access to" ON public.daily_report_staff;

CREATE POLICY "Staff can view own staff reports"
ON public.daily_report_staff
FOR SELECT
USING (staff_user_id = auth.uid());

CREATE POLICY "Managers can view staff reports"
ON public.daily_report_staff
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'ceo'::app_role)
  OR has_role(auth.uid(), 'general_manager'::app_role)
  OR has_role(auth.uid(), 'scaffold_executive_manager'::app_role)
  OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role)
);

-- daily_reports: allow staff to read only reports they participated in (for report_date display)
DROP POLICY IF EXISTS "Staff can view their report dates" ON public.daily_reports;

CREATE POLICY "Staff can view their report dates"
ON public.daily_reports
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.daily_report_staff drs
    WHERE drs.daily_report_id = daily_reports.id
      AND drs.staff_user_id = auth.uid()
  )
);
