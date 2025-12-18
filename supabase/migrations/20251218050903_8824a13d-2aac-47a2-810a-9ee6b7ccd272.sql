
-- Update get_my_projects_v3 function to exclude archived orders from customer view
CREATE OR REPLACE FUNCTION public.get_my_projects_v3()
RETURNS SETOF projects_v3
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.*
  FROM projects_v3 p
  JOIN customers c ON c.id = p.customer_id
  WHERE c.user_id = auth.uid()
    AND (p.is_archived IS NULL OR p.is_archived = false)
    AND (p.is_deep_archived IS NULL OR p.is_deep_archived = false)
  
  UNION
  
  SELECT p.*
  FROM projects_v3 p
  JOIN order_transfer_requests otr ON otr.order_id = p.id
  WHERE otr.to_user_id = auth.uid()
    AND otr.status IN ('pending_recipient', 'accepted', 'completed')
    AND (p.is_archived IS NULL OR p.is_archived = false)
    AND (p.is_deep_archived IS NULL OR p.is_deep_archived = false);
$$;
