ALTER TABLE public.order_collaborators
  ADD COLUMN IF NOT EXISTS can_view_financials boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS can_manage_order boolean NOT NULL DEFAULT false;

-- Allow the order owner (inviter) to update permissions of their collaborators
DROP POLICY IF EXISTS "Inviter can update own invitations" ON public.order_collaborators;
CREATE POLICY "Inviter can update own invitations"
ON public.order_collaborators
FOR UPDATE
TO authenticated
USING (inviter_user_id = auth.uid())
WITH CHECK (inviter_user_id = auth.uid());