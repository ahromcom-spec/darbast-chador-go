-- Create order collaborators table
CREATE TABLE public.order_collaborators (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.projects_v3(id) ON DELETE CASCADE,
  inviter_user_id UUID NOT NULL,
  invitee_user_id UUID,
  invitee_phone_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  invited_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  responded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.order_collaborators ENABLE ROW LEVEL SECURITY;

-- Policies for order collaborators
CREATE POLICY "Users can view their collaborations"
ON public.order_collaborators
FOR SELECT
USING (
  auth.uid() = inviter_user_id 
  OR auth.uid() = invitee_user_id
  OR EXISTS (
    SELECT 1 FROM projects_v3 p
    JOIN customers c ON c.id = p.customer_id
    WHERE p.id = order_collaborators.order_id AND c.user_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'ceo'::app_role)
  OR has_role(auth.uid(), 'general_manager'::app_role)
  OR has_role(auth.uid(), 'scaffold_executive_manager'::app_role)
  OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role)
  OR has_role(auth.uid(), 'sales_manager'::app_role)
);

CREATE POLICY "Users can create collaborator invites for own orders"
ON public.order_collaborators
FOR INSERT
WITH CHECK (
  auth.uid() = inviter_user_id
  AND (
    EXISTS (
      SELECT 1 FROM projects_v3 p
      JOIN customers c ON c.id = p.customer_id
      WHERE p.id = order_collaborators.order_id AND c.user_id = auth.uid()
    )
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'ceo'::app_role)
    OR has_role(auth.uid(), 'general_manager'::app_role)
    OR has_role(auth.uid(), 'scaffold_executive_manager'::app_role)
    OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role)
    OR has_role(auth.uid(), 'sales_manager'::app_role)
  )
);

CREATE POLICY "Invitees and managers can update collaborations"
ON public.order_collaborators
FOR UPDATE
USING (
  auth.uid() = invitee_user_id
  OR auth.uid() = inviter_user_id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'ceo'::app_role)
  OR has_role(auth.uid(), 'general_manager'::app_role)
  OR has_role(auth.uid(), 'scaffold_executive_manager'::app_role)
  OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role)
  OR has_role(auth.uid(), 'sales_manager'::app_role)
);

CREATE POLICY "Inviters can delete pending collaborations"
ON public.order_collaborators
FOR DELETE
USING (
  (auth.uid() = inviter_user_id AND status = 'pending')
  OR has_role(auth.uid(), 'admin'::app_role)
);