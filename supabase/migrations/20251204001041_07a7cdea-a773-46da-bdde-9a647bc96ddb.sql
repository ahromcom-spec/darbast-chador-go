-- Allow staff members to read customer data for voice calls
CREATE POLICY "Staff can view customers for orders" 
ON public.customers 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role IN (
      'scaffold_executive_manager',
      'executive_manager_scaffold_execution_with_materials',
      'general_manager',
      'sales_manager',
      'ceo',
      'admin'
    )
  )
);