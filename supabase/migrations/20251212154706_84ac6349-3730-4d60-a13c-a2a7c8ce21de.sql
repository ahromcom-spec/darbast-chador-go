-- Fix infinite recursion in RLS policies involving projects_v3 and order_transfer_requests
-- Simplify insert policy on order_transfer_requests to avoid referencing projects_v3
ALTER POLICY "Users can create transfer requests for own orders"
ON public.order_transfer_requests
WITH CHECK (auth.uid() = from_user_id);