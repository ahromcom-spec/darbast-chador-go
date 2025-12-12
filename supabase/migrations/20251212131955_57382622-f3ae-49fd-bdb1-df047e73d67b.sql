
-- Drop the old policy that checks for 'accepted'
DROP POLICY IF EXISTS "Collaborators can view orders they're accepted on" ON public.projects_v3;

-- Create new policy that checks for both 'accepted' and 'approved' status
CREATE POLICY "Collaborators can view orders they're accepted on"
ON public.projects_v3
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM order_collaborators oc
    WHERE oc.order_id = projects_v3.id
    AND oc.invitee_user_id = auth.uid()
    AND oc.status IN ('accepted', 'approved')
  )
);
