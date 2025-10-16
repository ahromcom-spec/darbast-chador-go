-- Add RLS policies for audit_log table
-- The audit_log table has RLS enabled but no policies, making it inaccessible

-- Policy for admins to view all audit logs
CREATE POLICY "Admins can view all audit logs"
ON audit_log FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'ceo'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role)
);

-- Policy for users to view their own audit logs
CREATE POLICY "Users can view own audit logs"
ON audit_log FOR SELECT
USING (actor_user_id = auth.uid());

-- Block all user modifications to audit logs (immutability)
-- Only security definer functions can write to audit_log
CREATE POLICY "Block user modifications to audit logs"
ON audit_log FOR INSERT
WITH CHECK (false);

CREATE POLICY "Block user updates to audit logs"
ON audit_log FOR UPDATE
USING (false)
WITH CHECK (false);

CREATE POLICY "Block user deletes from audit logs"
ON audit_log FOR DELETE
USING (false);