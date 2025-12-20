-- Drop the existing faulty policy
DROP POLICY IF EXISTS "Managers can create collection requests" ON public.collection_requests;

-- Create a corrected policy for managers to create collection requests
CREATE POLICY "Managers can create collection requests"
ON public.collection_requests
FOR INSERT
TO public
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = ANY (
        ARRAY[
          'admin'::app_role,
          'ceo'::app_role,
          'general_manager'::app_role,
          'scaffold_executive_manager'::app_role,
          'executive_manager_scaffold_execution_with_materials'::app_role,
          'rental_executive_manager'::app_role
        ]
      )
  )
);