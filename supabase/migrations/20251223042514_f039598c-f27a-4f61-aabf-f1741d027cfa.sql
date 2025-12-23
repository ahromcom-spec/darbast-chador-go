
-- Fix infinite recursion in RLS policies for daily_reports and daily_report_staff
-- The problem is circular reference between tables in the policies

-- Drop problematic policies
DROP POLICY IF EXISTS "Staff can view their report dates" ON daily_reports;
DROP POLICY IF EXISTS "Users can manage staff reports" ON daily_report_staff;

-- Recreate policy for daily_report_staff without referencing daily_reports
DROP POLICY IF EXISTS "Managers can view staff reports" ON daily_report_staff;
DROP POLICY IF EXISTS "Staff can view own staff reports" ON daily_report_staff;

-- Simple, non-recursive policies for daily_report_staff
CREATE POLICY "Staff can view own staff reports"
ON daily_report_staff
FOR SELECT
USING (staff_user_id = auth.uid());

CREATE POLICY "Managers can manage all staff reports"
ON daily_report_staff
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'ceo'::app_role) OR 
  has_role(auth.uid(), 'general_manager'::app_role) OR 
  has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR 
  has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role)
);
