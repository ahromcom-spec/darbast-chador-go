-- Create collection_requests table for customer collection requests
CREATE TABLE public.collection_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.projects_v3(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  description TEXT,
  requested_date TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'in_progress', 'completed', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create collection_request_messages table for chat
CREATE TABLE public.collection_request_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  collection_request_id UUID NOT NULL REFERENCES public.collection_requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  message TEXT NOT NULL,
  is_staff BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.collection_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_request_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for collection_requests
CREATE POLICY "Customers can view their own collection requests"
  ON public.collection_requests FOR SELECT
  USING (customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid()));

CREATE POLICY "Customers can create collection requests"
  ON public.collection_requests FOR INSERT
  WITH CHECK (customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid()));

CREATE POLICY "Customers can update their own pending requests"
  ON public.collection_requests FOR UPDATE
  USING (customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid()) AND status = 'pending');

CREATE POLICY "Managers can view all collection requests"
  ON public.collection_requests FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'ceo', 'general_manager', 'sales_manager', 'scaffold_executive_manager', 'executive_manager_scaffold_execution_with_materials', 'finance_manager')
  ));

CREATE POLICY "Managers can update collection requests"
  ON public.collection_requests FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'ceo', 'general_manager', 'scaffold_executive_manager', 'executive_manager_scaffold_execution_with_materials')
  ));

-- RLS policies for collection_request_messages
CREATE POLICY "Users can view messages for their requests"
  ON public.collection_request_messages FOR SELECT
  USING (
    collection_request_id IN (
      SELECT id FROM public.collection_requests 
      WHERE customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'ceo', 'general_manager', 'sales_manager', 'scaffold_executive_manager', 'executive_manager_scaffold_execution_with_materials', 'finance_manager')
    )
  );

CREATE POLICY "Authenticated users can send messages"
  ON public.collection_request_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_collection_requests_updated_at
  BEFORE UPDATE ON public.collection_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.collection_request_messages;