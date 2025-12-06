-- Allow transfer recipients to view orders pending their acceptance
CREATE POLICY "Transfer recipients can view orders pending acceptance"
ON projects_v3
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM order_transfer_requests otr
    WHERE otr.order_id = projects_v3.id
    AND otr.to_user_id = auth.uid()
    AND otr.status = 'pending_recipient'
  )
);