-- Remove any remaining duplicate/conflicting policies on order_collaborators
DROP POLICY IF EXISTS "Users can view their collaborations" ON order_collaborators;
DROP POLICY IF EXISTS "Inviters can delete pending collaborations" ON order_collaborators;
DROP POLICY IF EXISTS "Invitees and managers can update collaborations" ON order_collaborators;