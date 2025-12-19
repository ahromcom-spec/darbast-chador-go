-- Fix executive stage workflow permissions for projects_v3

-- 1) Executive managers should be able to SEE orders once they reach "pending_execution" or "scheduled"
DROP POLICY IF EXISTS "Executive managers can view approved and in-progress orders" ON public.projects_v3;
CREATE POLICY "Executive managers can view approved and in-progress orders"
ON public.projects_v3
FOR SELECT
USING (
  (
    has_role(auth.uid(), 'scaffold_executive_manager'::app_role)
    OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role)
  )
  AND (
    status = ANY (
      ARRAY[
        'approved'::project_status_v3,
        'pending_execution'::project_status_v3,
        'scheduled'::project_status_v3,
        'in_progress'::project_status_v3,
        'completed'::project_status_v3
      ]
    )
  )
);

-- 2) Allow executive managers to UPDATE orders in the execution workflow, including scheduled & pending_execution
DROP POLICY IF EXISTS "Executive managers can update execution details" ON public.projects_v3;
CREATE POLICY "Executive managers can update execution details"
ON public.projects_v3
FOR UPDATE
USING (
  (
    has_role(auth.uid(), 'scaffold_executive_manager'::app_role)
    OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role)
  )
  AND (
    status = ANY (
      ARRAY[
        'approved'::project_status_v3,
        'pending_execution'::project_status_v3,
        'scheduled'::project_status_v3,
        'in_progress'::project_status_v3,
        'completed'::project_status_v3
      ]
    )
  )
)
WITH CHECK (
  (
    has_role(auth.uid(), 'scaffold_executive_manager'::app_role)
    OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role)
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

-- 3) When an order is still pending, allow executive managers to move it into the execution workflow if needed
DROP POLICY IF EXISTS "Executive managers can edit pending orders" ON public.projects_v3;
CREATE POLICY "Executive managers can edit pending orders"
ON public.projects_v3
FOR UPDATE
USING (
  (
    has_role(auth.uid(), 'scaffold_executive_manager'::app_role)
    OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role)
  )
  AND (status = 'pending'::project_status_v3)
)
WITH CHECK (
  (
    has_role(auth.uid(), 'scaffold_executive_manager'::app_role)
    OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role)
  )
  AND (
    status = ANY (
      ARRAY[
        'pending'::project_status_v3,
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