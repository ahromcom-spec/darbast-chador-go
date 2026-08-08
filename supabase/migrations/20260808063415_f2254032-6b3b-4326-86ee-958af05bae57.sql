CREATE POLICY "Managers can view all hierarchy projects"
ON public.projects_hierarchy
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'ceo'::app_role)
  OR public.has_role(auth.uid(), 'general_manager'::app_role)
  OR public.has_role(auth.uid(), 'sales_manager'::app_role)
  OR public.has_role(auth.uid(), 'scaffold_executive_manager'::app_role)
  OR public.has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role)
  OR public.has_role(auth.uid(), 'rental_executive_manager'::app_role)
);