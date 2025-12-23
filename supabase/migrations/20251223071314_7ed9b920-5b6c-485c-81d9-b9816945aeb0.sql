-- Drop the old restrictive DELETE policy that requires created_by = auth.uid()
-- This conflicts with the newer "Managers can delete any daily report" policy
DROP POLICY IF EXISTS "CEO and managers can delete own daily reports" ON public.daily_reports;

-- The remaining "Managers can delete any daily report" policy already covers all cases:
-- - Managers (admin, ceo, general_manager, scaffold_executive_manager, executive_manager_scaffold_execution_with_materials) can delete ANY report
-- - Creators can delete their own reports