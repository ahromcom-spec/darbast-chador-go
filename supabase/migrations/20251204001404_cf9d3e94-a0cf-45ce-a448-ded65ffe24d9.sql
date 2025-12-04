-- Allow executive managers to view all profiles for voice calls
CREATE POLICY "Executive managers can view profiles" 
ON public.profiles 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role IN (
      'scaffold_executive_manager',
      'executive_manager_scaffold_execution_with_materials',
      'sales_manager'
    )
  )
);