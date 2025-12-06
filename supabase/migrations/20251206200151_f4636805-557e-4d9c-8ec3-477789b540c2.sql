-- Create a function to transfer order ownership that bypasses RLS
CREATE OR REPLACE FUNCTION public.transfer_order_ownership(
  p_order_id UUID,
  p_new_customer_id UUID,
  p_new_hierarchy_id UUID,
  p_transferred_from_user_id UUID,
  p_transferred_from_phone TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update the order with new ownership
  UPDATE projects_v3
  SET 
    customer_id = p_new_customer_id,
    hierarchy_project_id = p_new_hierarchy_id,
    transferred_from_user_id = p_transferred_from_user_id,
    transferred_from_phone = p_transferred_from_phone
  WHERE id = p_order_id;
END;
$$;