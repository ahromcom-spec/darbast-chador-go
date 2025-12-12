
-- Update get_my_projects_v3 function to include orders where user is an accepted collaborator
CREATE OR REPLACE FUNCTION public.get_my_projects_v3()
RETURNS SETOF public.projects_v3
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  -- Get orders where user is the customer
  SELECT p.*
  FROM projects_v3 p
  JOIN customers c ON c.id = p.customer_id
  WHERE c.user_id = auth.uid()
  
  UNION
  
  -- Get orders where user is an accepted collaborator
  SELECT p.*
  FROM projects_v3 p
  JOIN order_collaborators oc ON oc.order_id = p.id
  WHERE oc.invitee_user_id = auth.uid()
    AND oc.status = 'accepted';
$$;
