-- Add rental_executive_manager to collection_requests update policy
DROP POLICY IF EXISTS "Managers can update collection requests" ON public.collection_requests;

CREATE POLICY "Managers can update collection requests"
ON public.collection_requests
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = ANY(ARRAY[
      'admin'::app_role, 
      'ceo'::app_role, 
      'general_manager'::app_role, 
      'scaffold_executive_manager'::app_role, 
      'executive_manager_scaffold_execution_with_materials'::app_role,
      'rental_executive_manager'::app_role
    ])
  )
);

-- Also add to view policy
DROP POLICY IF EXISTS "Managers can view all collection requests" ON public.collection_requests;

CREATE POLICY "Managers can view all collection requests"
ON public.collection_requests
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = ANY(ARRAY[
      'admin'::app_role, 
      'ceo'::app_role, 
      'general_manager'::app_role, 
      'sales_manager'::app_role,
      'scaffold_executive_manager'::app_role, 
      'executive_manager_scaffold_execution_with_materials'::app_role,
      'rental_executive_manager'::app_role,
      'finance_manager'::app_role
    ])
  )
);