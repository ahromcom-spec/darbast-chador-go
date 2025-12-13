-- Drop existing problematic policies on order_collaborators
DROP POLICY IF EXISTS "Inviter can view invitations" ON order_collaborators;
DROP POLICY IF EXISTS "Invitee can view invitations" ON order_collaborators;
DROP POLICY IF EXISTS "Order owner can view collaborators" ON order_collaborators;
DROP POLICY IF EXISTS "Managers can view all collaborators" ON order_collaborators;
DROP POLICY IF EXISTS "Users can insert collaborators" ON order_collaborators;
DROP POLICY IF EXISTS "Users can delete collaborators" ON order_collaborators;
DROP POLICY IF EXISTS "Invitee can update own invitation" ON order_collaborators;
DROP POLICY IF EXISTS "Order owner can manage collaborators" ON order_collaborators;

-- Create simple, non-recursive RLS policies

-- SELECT: Inviter can see their own invitations
CREATE POLICY "Inviter can view own invitations"
ON order_collaborators FOR SELECT
USING (inviter_user_id = auth.uid());

-- SELECT: Invitee can see invitations sent to them
CREATE POLICY "Invitee can view own invitations"
ON order_collaborators FOR SELECT
USING (invitee_user_id = auth.uid());

-- SELECT: Managers can view all collaborators
CREATE POLICY "Managers can view collaborators"
ON order_collaborators FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'ceo', 'general_manager', 'sales_manager', 'scaffold_executive_manager')
  )
);

-- INSERT: Any authenticated user can create collaborator invitations
CREATE POLICY "Users can create collaborator invitations"
ON order_collaborators FOR INSERT
WITH CHECK (inviter_user_id = auth.uid());

-- UPDATE: Invitee can update their own invitation (accept/reject)
CREATE POLICY "Invitee can respond to invitation"
ON order_collaborators FOR UPDATE
USING (invitee_user_id = auth.uid());

-- DELETE: Inviter can delete their own pending invitations
CREATE POLICY "Inviter can delete own invitations"
ON order_collaborators FOR DELETE
USING (inviter_user_id = auth.uid());