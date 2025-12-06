-- Add RLS policy to allow transfer recipients to update the order during transfer acceptance
CREATE POLICY "Transfer recipients can update order during acceptance"
ON public.projects_v3
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM order_transfer_requests otr
    WHERE otr.order_id = projects_v3.id
    AND otr.to_user_id = auth.uid()
    AND otr.status = 'pending_recipient'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM order_transfer_requests otr
    WHERE otr.order_id = projects_v3.id
    AND otr.to_user_id = auth.uid()
    AND otr.status = 'pending_recipient'
  )
);