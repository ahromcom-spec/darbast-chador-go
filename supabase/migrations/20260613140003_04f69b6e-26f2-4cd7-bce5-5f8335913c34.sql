
-- Add manager approval fields to order_collaborators
ALTER TABLE public.order_collaborators
  ADD COLUMN IF NOT EXISTS manager_approved_by uuid,
  ADD COLUMN IF NOT EXISTS manager_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS manager_rejection_reason text;

-- Change default status to pending_manager (new invites need manager approval first)
ALTER TABLE public.order_collaborators
  ALTER COLUMN status SET DEFAULT 'pending_manager';

-- Update invitee SELECT policy: only show after manager approval
DROP POLICY IF EXISTS "Invitee can view own invitations" ON public.order_collaborators;
CREATE POLICY "Invitee can view own invitations"
ON public.order_collaborators
FOR SELECT
USING (
  status NOT IN ('pending_manager', 'manager_rejected')
  AND (
    invitee_user_id = auth.uid()
    OR invitee_phone_number = (
      SELECT p.phone_number FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1
    )
  )
);

-- Update invitee UPDATE policy: only allow responding to manager-approved invites
DROP POLICY IF EXISTS "Invitee can respond to invitation" ON public.order_collaborators;
CREATE POLICY "Invitee can respond to invitation"
ON public.order_collaborators
FOR UPDATE
USING (
  status IN ('pending', 'manager_approved', 'pending_registration')
  AND (
    invitee_user_id = auth.uid()
    OR invitee_phone_number = (
      SELECT p.phone_number FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1
    )
  )
)
WITH CHECK (
  invitee_user_id = auth.uid()
  OR invitee_phone_number = (
    SELECT p.phone_number FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1
  )
);

-- Allow managers to update (approve/reject) collaborator invites
DROP POLICY IF EXISTS "Managers can update collaborators" ON public.order_collaborators;
CREATE POLICY "Managers can update collaborators"
ON public.order_collaborators
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'ceo'::app_role)
  OR has_role(auth.uid(), 'general_manager'::app_role)
  OR has_role(auth.uid(), 'sales_manager'::app_role)
  OR has_role(auth.uid(), 'scaffold_executive_manager'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'ceo'::app_role)
  OR has_role(auth.uid(), 'general_manager'::app_role)
  OR has_role(auth.uid(), 'sales_manager'::app_role)
  OR has_role(auth.uid(), 'scaffold_executive_manager'::app_role)
);

-- Update auto-assign trigger to only attach manager-approved invites to newly registered users
CREATE OR REPLACE FUNCTION public.auto_assign_pending_collaborations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.phone_number IS NOT NULL AND NEW.user_id IS NOT NULL THEN
    UPDATE public.order_collaborators
    SET invitee_user_id = NEW.user_id,
        updated_at = now()
    WHERE invitee_phone_number = NEW.phone_number
      AND invitee_user_id IS NULL
      AND status IN ('pending', 'manager_approved', 'pending_registration');
  END IF;
  RETURN NEW;
END;
$$;
