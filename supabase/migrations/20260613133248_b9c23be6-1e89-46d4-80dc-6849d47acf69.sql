DROP POLICY IF EXISTS "Managers can update transfer requests" ON public.order_transfer_requests;
CREATE POLICY "Managers can update transfer requests"
ON public.order_transfer_requests
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'ceo'::app_role)
  OR has_role(auth.uid(), 'general_manager'::app_role)
  OR has_role(auth.uid(), 'scaffold_executive_manager'::app_role)
  OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role)
  OR has_role(auth.uid(), 'sales_manager'::app_role)
  OR auth.uid() = to_user_id
  OR auth.uid() = from_user_id
  OR to_phone_number = (
    SELECT p.phone_number FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1
  )
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'ceo'::app_role)
  OR has_role(auth.uid(), 'general_manager'::app_role)
  OR has_role(auth.uid(), 'scaffold_executive_manager'::app_role)
  OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role)
  OR has_role(auth.uid(), 'sales_manager'::app_role)
  OR auth.uid() = to_user_id
  OR auth.uid() = from_user_id
  OR to_phone_number = (
    SELECT p.phone_number FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1
  )
);

CREATE OR REPLACE FUNCTION public.transfer_order_ownership(
  p_order_id uuid,
  p_new_customer_id uuid,
  p_new_hierarchy_id uuid,
  p_transferred_from_user_id uuid,
  p_transferred_from_phone text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transfer_request_exists boolean;
  v_user_phone text;
BEGIN
  SELECT phone_number INTO v_user_phone
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  SELECT EXISTS(
    SELECT 1
    FROM public.order_transfer_requests otr
    WHERE otr.order_id = p_order_id
      AND otr.status IN ('pending_recipient', 'pending_registration')
      AND (
        otr.to_user_id = auth.uid()
        OR (v_user_phone IS NOT NULL AND otr.to_phone_number = v_user_phone)
      )
  ) INTO v_transfer_request_exists;

  IF NOT v_transfer_request_exists THEN
    RAISE EXCEPTION 'Unauthorized: No valid transfer request found for this user';
  END IF;

  UPDATE public.projects_v3
  SET
    customer_id = p_new_customer_id,
    hierarchy_project_id = p_new_hierarchy_id,
    transferred_from_user_id = p_transferred_from_user_id,
    transferred_from_phone = p_transferred_from_phone
  WHERE id = p_order_id;

  UPDATE public.order_transfer_requests
  SET
    status = 'completed',
    to_user_id = auth.uid(),
    recipient_responded_at = now(),
    updated_at = now()
  WHERE order_id = p_order_id
    AND status IN ('pending_recipient', 'pending_registration')
    AND (
      to_user_id = auth.uid()
      OR (v_user_phone IS NOT NULL AND to_phone_number = v_user_phone)
    );
END;
$$;