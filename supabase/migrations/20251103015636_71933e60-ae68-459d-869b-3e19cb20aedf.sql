-- Fix wrong RLS policies preventing executives/sales from seeing pending approvals
DROP POLICY IF EXISTS "Exec can view pending awaiting their approval" ON public.projects_v3;
CREATE POLICY "Exec can view pending awaiting their approval"
ON public.projects_v3
FOR SELECT
USING (
  has_role(auth.uid(), 'scaffold_executive_manager'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.order_approvals oa
    WHERE oa.order_id = projects_v3.id
      AND oa.approved_at IS NULL
      AND (
        oa.approver_role = 'scaffold_executive_manager'::text OR
        oa.approver_role = 'executive_manager_scaffold_execution_with_materials'::text
      )
  )
);

DROP POLICY IF EXISTS "Sales can view pending awaiting their approval" ON public.projects_v3;
CREATE POLICY "Sales can view pending awaiting their approval"
ON public.projects_v3
FOR SELECT
USING (
  has_role(auth.uid(), 'sales_manager'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.order_approvals oa
    WHERE oa.order_id = projects_v3.id
      AND oa.approved_at IS NULL
      AND (
        oa.approver_role = 'sales_manager'::text OR
        oa.approver_role = 'sales_manager_scaffold_execution_with_materials'::text
      )
  )
);
