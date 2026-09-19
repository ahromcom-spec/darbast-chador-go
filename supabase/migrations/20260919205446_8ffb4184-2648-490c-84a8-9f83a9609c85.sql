CREATE POLICY "Users and managers can update project media"
ON public.project_media
FOR UPDATE
TO authenticated
USING (
  ((auth.uid() = user_id) AND check_order_ownership(project_id, auth.uid()))
  OR check_order_ownership(project_id, auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'ceo'::app_role)
  OR has_role(auth.uid(), 'general_manager'::app_role)
  OR has_role(auth.uid(), 'sales_manager'::app_role)
  OR has_role(auth.uid(), 'scaffold_executive_manager'::app_role)
  OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role)
  OR has_role(auth.uid(), 'finance_manager'::app_role)
  OR (has_role(auth.uid(), 'rental_executive_manager'::app_role) AND EXISTS (
    SELECT 1 FROM projects_v3 p JOIN subcategories s ON s.id = p.subcategory_id
    WHERE p.id = project_media.project_id AND s.code = '30'
  ))
)
WITH CHECK (
  check_order_ownership(project_id, auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'ceo'::app_role)
  OR has_role(auth.uid(), 'general_manager'::app_role)
  OR has_role(auth.uid(), 'sales_manager'::app_role)
  OR has_role(auth.uid(), 'scaffold_executive_manager'::app_role)
  OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role)
  OR has_role(auth.uid(), 'finance_manager'::app_role)
  OR (has_role(auth.uid(), 'rental_executive_manager'::app_role) AND EXISTS (
    SELECT 1 FROM projects_v3 p JOIN subcategories s ON s.id = p.subcategory_id
    WHERE p.id = project_media.project_id AND s.code = '30'
  ))
);