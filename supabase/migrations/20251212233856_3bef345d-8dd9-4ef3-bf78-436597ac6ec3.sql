
-- Update check_order_ownership to include collaborators
CREATE OR REPLACE FUNCTION public.check_order_ownership(_order_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- Check if user is the customer
    SELECT 1 
    FROM projects_v3 p
    JOIN customers c ON c.id = p.customer_id
    WHERE p.id = _order_id AND c.user_id = _user_id
  )
  OR EXISTS (
    -- Check if user is an accepted collaborator
    SELECT 1
    FROM order_collaborators oc
    WHERE oc.order_id = _order_id 
      AND oc.invitee_user_id = _user_id 
      AND oc.status = 'accepted'
  );
$$;
