-- Add RLS policy for managers to read phone_whitelist
CREATE POLICY "Managers can view phone whitelist" 
ON public.phone_whitelist 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'sales_manager'::app_role) OR
  has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR
  has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role) OR
  has_role(auth.uid(), 'finance_manager'::app_role)
);