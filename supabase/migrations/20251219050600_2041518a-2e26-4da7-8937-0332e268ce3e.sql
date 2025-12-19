-- Enable realtime payload to include all columns so filters on order_id work for UPDATE events
ALTER TABLE public.order_approvals REPLICA IDENTITY FULL;

-- Ensure order_approvals emits realtime events
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_approvals;