-- Update RLS policy to allow executive managers to view and manage order transfer requests
DROP POLICY IF EXISTS "Users can view own transfer requests" ON public.order_transfer_requests;

CREATE POLICY "Users can view own transfer requests" 
ON public.order_transfer_requests 
FOR SELECT 
USING (
  (auth.uid() = from_user_id) OR 
  (auth.uid() = to_user_id) OR 
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'ceo'::app_role) OR 
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR
  has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role) OR
  has_role(auth.uid(), 'sales_manager'::app_role)
);

-- Update the UPDATE policy to include executive managers
DROP POLICY IF EXISTS "Managers can update transfer requests" ON public.order_transfer_requests;

CREATE POLICY "Managers can update transfer requests" 
ON public.order_transfer_requests 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'ceo'::app_role) OR 
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR
  has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role) OR
  has_role(auth.uid(), 'sales_manager'::app_role) OR
  (auth.uid() = to_user_id) OR
  (auth.uid() = from_user_id)
);

-- Add DELETE policy for users to cancel their own pending transfer requests
DROP POLICY IF EXISTS "Users can cancel own pending transfer requests" ON public.order_transfer_requests;

CREATE POLICY "Users can cancel own pending transfer requests" 
ON public.order_transfer_requests 
FOR DELETE 
USING (
  (auth.uid() = from_user_id AND status = 'pending_manager')
);