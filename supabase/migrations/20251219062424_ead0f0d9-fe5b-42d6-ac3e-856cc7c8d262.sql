-- Update the existing policy to allow executive managers to update orders to closed status
DROP POLICY IF EXISTS "Executive managers can update execution details" ON public.projects_v3;

CREATE POLICY "Executive managers can update execution details"
ON public.projects_v3
FOR UPDATE
USING (
  (has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role))
  AND (status = ANY (ARRAY['approved'::project_status_v3, 'in_progress'::project_status_v3, 'completed'::project_status_v3]))
)
WITH CHECK (
  (has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role))
  AND (status = ANY (ARRAY['approved'::project_status_v3, 'pending_execution'::project_status_v3, 'in_progress'::project_status_v3, 'completed'::project_status_v3, 'closed'::project_status_v3]))
);