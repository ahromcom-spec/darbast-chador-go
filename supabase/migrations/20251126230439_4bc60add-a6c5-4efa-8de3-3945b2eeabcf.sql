-- Allow customers to delete any of their orders that have not been approved by managers yet
-- and also allow deletion of rejected/cancelled orders.

-- 1) Remove old restrictive delete policy if it exists
DROP POLICY IF EXISTS "Users can delete their rejected orders" ON public.projects_v3;

-- 2) Create new delete policy based on approval status
CREATE POLICY "Users can delete their unapproved or rejected orders"
ON public.projects_v3
FOR DELETE
TO authenticated
USING (
  -- Must be the customer who owns the order
  customer_id IN (
    SELECT c.id FROM public.customers c
    WHERE c.user_id = auth.uid()
  )
  AND (
    -- Orders that have never been approved by managers
    approved_at IS NULL
    -- Or orders that are explicitly rejected (e.g. cancelled by user or rejected by managers)
    OR status = 'rejected'::public.project_status_v3
  )
);
