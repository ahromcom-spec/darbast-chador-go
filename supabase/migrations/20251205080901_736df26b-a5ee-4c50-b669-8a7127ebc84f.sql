-- Drop the old constraint and add new one with incoming-call type
ALTER TABLE public.notifications 
DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications 
ADD CONSTRAINT notifications_type_check 
CHECK (type IS NULL OR type IN ('info', 'success', 'warning', 'error', 'order-update', 'call', 'incoming-call'));