
CREATE POLICY "Managers can update locations for accessible orders"
ON public.locations
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'ceo'::app_role)
  OR has_role(auth.uid(), 'general_manager'::app_role)
  OR has_role(auth.uid(), 'sales_manager'::app_role)
  OR has_role(auth.uid(), 'scaffold_executive_manager'::app_role)
  OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role)
  OR has_role(auth.uid(), 'rental_executive_manager'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'ceo'::app_role)
  OR has_role(auth.uid(), 'general_manager'::app_role)
  OR has_role(auth.uid(), 'sales_manager'::app_role)
  OR has_role(auth.uid(), 'scaffold_executive_manager'::app_role)
  OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role)
  OR has_role(auth.uid(), 'rental_executive_manager'::app_role)
);

CREATE POLICY "Managers can view all locations"
ON public.locations
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'ceo'::app_role)
  OR has_role(auth.uid(), 'general_manager'::app_role)
  OR has_role(auth.uid(), 'sales_manager'::app_role)
  OR has_role(auth.uid(), 'scaffold_executive_manager'::app_role)
  OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role)
  OR has_role(auth.uid(), 'rental_executive_manager'::app_role)
);
