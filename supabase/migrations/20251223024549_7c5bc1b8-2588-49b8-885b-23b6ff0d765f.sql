-- Add policy for users with daily report or HR module access to view HR employees
CREATE POLICY "Users with module access can view HR employees"
ON public.hr_employees
FOR SELECT
USING (
  has_role(auth.uid(), 'ceo'::app_role) 
  OR has_role(auth.uid(), 'general_manager'::app_role)
  OR has_role(auth.uid(), 'scaffold_executive_manager'::app_role)
  OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role)
);