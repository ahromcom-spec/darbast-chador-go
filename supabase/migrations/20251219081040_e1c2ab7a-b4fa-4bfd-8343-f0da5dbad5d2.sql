-- Allow executive managers to update stage even when order is currently closed
ALTER POLICY "Executive managers can update execution details"
ON public.projects_v3
USING (
  (
    public.has_role(auth.uid(), 'scaffold_executive_manager'::app_role)
    OR public.has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role)
  )
  AND (
    status = ANY (
      ARRAY[
        'approved'::project_status_v3,
        'pending_execution'::project_status_v3,
        'scheduled'::project_status_v3,
        'in_progress'::project_status_v3,
        'completed'::project_status_v3,
        'closed'::project_status_v3
      ]
    )
  )
)
WITH CHECK (
  (
    public.has_role(auth.uid(), 'scaffold_executive_manager'::app_role)
    OR public.has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role)
  )
  AND (
    status = ANY (
      ARRAY[
        'approved'::project_status_v3,
        'pending_execution'::project_status_v3,
        'scheduled'::project_status_v3,
        'in_progress'::project_status_v3,
        'completed'::project_status_v3,
        'closed'::project_status_v3
      ]
    )
  )
);
