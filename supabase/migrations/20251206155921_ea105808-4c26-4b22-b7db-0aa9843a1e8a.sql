-- Create order transfer requests table
CREATE TABLE public.order_transfer_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.projects_v3(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL,
  to_user_id UUID,
  to_phone_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_manager', -- pending_manager, manager_approved, manager_rejected, pending_recipient, recipient_accepted, recipient_rejected, completed
  manager_approved_by UUID,
  manager_approved_at TIMESTAMP WITH TIME ZONE,
  manager_rejection_reason TEXT,
  recipient_responded_at TIMESTAMP WITH TIME ZONE,
  recipient_rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.order_transfer_requests ENABLE ROW LEVEL SECURITY;

-- Policies for order transfer requests
CREATE POLICY "Users can create transfer requests for own orders"
ON public.order_transfer_requests
FOR INSERT
WITH CHECK (
  auth.uid() = from_user_id AND
  EXISTS (
    SELECT 1 FROM projects_v3 p
    JOIN customers c ON c.id = p.customer_id
    WHERE p.id = order_transfer_requests.order_id AND c.user_id = auth.uid()
  )
);

CREATE POLICY "Users can view own transfer requests"
ON public.order_transfer_requests
FOR SELECT
USING (
  auth.uid() = from_user_id OR 
  auth.uid() = to_user_id OR
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'ceo'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role)
);

CREATE POLICY "Managers can update transfer requests"
ON public.order_transfer_requests
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'ceo'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  auth.uid() = to_user_id
);

-- Add transferred_from_user_id column to projects_v3 to track original owner
ALTER TABLE public.projects_v3 
ADD COLUMN transferred_from_user_id UUID,
ADD COLUMN transferred_from_phone TEXT;

-- Create index for faster lookups
CREATE INDEX idx_order_transfer_requests_order_id ON public.order_transfer_requests(order_id);
CREATE INDEX idx_order_transfer_requests_to_phone ON public.order_transfer_requests(to_phone_number);
CREATE INDEX idx_order_transfer_requests_status ON public.order_transfer_requests(status);