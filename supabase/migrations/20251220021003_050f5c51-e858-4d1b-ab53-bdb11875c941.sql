-- Allow managers to create collection requests on behalf of the customer (for the same order)
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
  AND EXISTS (
    SELECT 1
    FROM public.projects_v3 p
    WHERE p.id = order_id
      AND p.customer_id = customer_id
  )
);