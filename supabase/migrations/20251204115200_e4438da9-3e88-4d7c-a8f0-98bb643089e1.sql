-- Create call_logs table for storing call history
CREATE TABLE public.call_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.projects_v3(id) ON DELETE CASCADE,
  caller_id UUID NOT NULL,
  receiver_id UUID NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  answered_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ringing' CHECK (status IN ('ringing', 'answered', 'missed', 'rejected', 'timeout')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;

-- Users can view call logs for their orders
CREATE POLICY "Users can view call logs for own orders"
ON public.call_logs FOR SELECT
USING (
  auth.uid() = caller_id 
  OR auth.uid() = receiver_id
  OR EXISTS (
    SELECT 1 FROM projects_v3 p
    JOIN customers c ON c.id = p.customer_id
    WHERE p.id = call_logs.order_id AND c.user_id = auth.uid()
  )
);

-- Users can create call logs
CREATE POLICY "Users can create call logs"
ON public.call_logs FOR INSERT
WITH CHECK (auth.uid() = caller_id);

-- Users can update their call logs
CREATE POLICY "Users can update call logs"
ON public.call_logs FOR UPDATE
USING (auth.uid() = caller_id OR auth.uid() = receiver_id);

-- Staff can view all call logs
CREATE POLICY "Staff can view all call logs"
ON public.call_logs FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'ceo'::app_role)
  OR has_role(auth.uid(), 'general_manager'::app_role)
  OR has_role(auth.uid(), 'scaffold_executive_manager'::app_role)
  OR has_role(auth.uid(), 'sales_manager'::app_role)
);

-- Enable realtime for call_logs
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_logs;

-- Create index for faster queries
CREATE INDEX idx_call_logs_order_id ON public.call_logs(order_id);
CREATE INDEX idx_call_logs_caller_id ON public.call_logs(caller_id);
CREATE INDEX idx_call_logs_receiver_id ON public.call_logs(receiver_id);