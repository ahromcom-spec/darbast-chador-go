DROP POLICY IF EXISTS "Users and managers can delete project media" ON public.project_media;

CREATE POLICY "Users and managers can delete project media"
ON public.project_media
FOR DELETE
TO authenticated
USING (
  (
    auth.uid() = user_id
    AND public.check_order_ownership(project_id, auth.uid())
  )
  OR
  (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'ceo'::app_role)
    OR public.has_role(auth.uid(), 'general_manager'::app_role)
    OR public.has_role(auth.uid(), 'sales_manager'::app_role)
    OR public.has_role(auth.uid(), 'scaffold_executive_manager'::app_role)
    OR public.has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role)
    OR public.has_role(auth.uid(), 'finance_manager'::app_role)
  )
);