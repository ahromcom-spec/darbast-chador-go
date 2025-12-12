
-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Users can create collaborator invites for own orders" ON public.order_collaborators;

-- Create a security definer function to check order ownership without RLS interference
CREATE OR REPLACE FUNCTION public.check_order_ownership(_order_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM projects_v3 p
    JOIN customers c ON c.id = p.customer_id
    WHERE p.id = _order_id AND c.user_id = _user_id
  );
$$;

-- Create new INSERT policy using the security definer function
CREATE POLICY "Users can create collaborator invites for own orders" ON public.order_collaborators
FOR INSERT
WITH CHECK (
  auth.uid() = inviter_user_id 
  AND (
    public.check_order_ownership(order_id, auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'ceo'::app_role)
    OR has_role(auth.uid(), 'general_manager'::app_role)
    OR has_role(auth.uid(), 'scaffold_executive_manager'::app_role)
    OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role)
    OR has_role(auth.uid(), 'sales_manager'::app_role)
  )
);
