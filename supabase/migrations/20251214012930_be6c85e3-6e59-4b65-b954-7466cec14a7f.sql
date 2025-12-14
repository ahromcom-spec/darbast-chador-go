-- Drop the restrictive INSERT policy
DROP POLICY IF EXISTS "Users can create ratings for completed projects" ON public.ratings;

-- Create a more permissive INSERT policy that allows customers to rate completed orders
CREATE POLICY "Users can create ratings for their orders"
ON public.ratings
FOR INSERT
WITH CHECK (
  auth.uid() = rater_id
  AND EXISTS (
    SELECT 1 FROM projects_v3 p
    JOIN customers c ON c.id = p.customer_id
    WHERE p.id = ratings.project_id
    AND (
      -- Customer can rate their own orders
      c.user_id = auth.uid()
      -- Or collaborator can rate
      OR EXISTS (
        SELECT 1 FROM order_collaborators oc
        WHERE oc.order_id = p.id
        AND oc.invitee_user_id = auth.uid()
        AND oc.status = 'accepted'
      )
      -- Or staff/contractor can rate customers
      OR has_role(auth.uid(), 'scaffold_executive_manager'::app_role)
      OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role)
      OR has_role(auth.uid(), 'contractor'::app_role)
    )
  )
);