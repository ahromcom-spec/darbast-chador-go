-- Allow executive managers to still view pending orders they have already approved
-- This keeps orders visible in their work queue until execution starts

-- Create a new SELECT policy on projects_v3
CREATE POLICY "Executive managers can view pending they approved"
ON public.projects_v3
FOR SELECT
USING (
  (has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role))
  AND (status = 'pending'::project_status_v3)
  AND EXISTS (
    SELECT 1 FROM public.order_approvals oa
    WHERE oa.order_id = projects_v3.id
      AND oa.approver_user_id = auth.uid()
      AND oa.approved_at IS NOT NULL
      AND oa.approver_role IN ('scaffold_executive_manager','executive_manager_scaffold_execution_with_materials')
  )
);
