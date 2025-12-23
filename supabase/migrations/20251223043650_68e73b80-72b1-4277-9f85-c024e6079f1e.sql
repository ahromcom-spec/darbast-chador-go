
-- Allow staff members to view daily_reports that contain their records
-- Using a simple subquery approach (not recursive since it queries a different table)
CREATE POLICY "Staff can view reports containing their records"
ON daily_reports
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM daily_report_staff drs
    WHERE drs.daily_report_id = daily_reports.id
    AND drs.staff_user_id = auth.uid()
  )
);
