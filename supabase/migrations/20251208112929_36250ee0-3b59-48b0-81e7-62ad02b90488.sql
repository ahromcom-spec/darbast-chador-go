-- Create repair requests table
CREATE TABLE public.repair_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.projects_v3(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed', 'paid')),
  estimated_cost NUMERIC DEFAULT 1500000,
  final_cost NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  approved_by UUID,
  completed_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  payment_reference TEXT
);

-- Create repair request media table
CREATE TABLE public.repair_request_media (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  repair_request_id UUID NOT NULL REFERENCES public.repair_requests(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('image', 'video')),
  file_size INTEGER,
  mime_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID NOT NULL
);

-- Create repair request messages table
CREATE TABLE public.repair_request_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  repair_request_id UUID NOT NULL REFERENCES public.repair_requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  message TEXT NOT NULL,
  is_staff BOOLEAN DEFAULT false,
  audio_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.repair_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_request_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_request_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for repair_requests
CREATE POLICY "Customers can view their own repair requests"
ON public.repair_requests FOR SELECT
USING (
  customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())
);

CREATE POLICY "Customers can create repair requests"
ON public.repair_requests FOR INSERT
WITH CHECK (
  customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())
);

CREATE POLICY "Customers can update their pending repair requests"
ON public.repair_requests FOR UPDATE
USING (
  customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())
  AND status = 'pending'
);

CREATE POLICY "Managers can view all repair requests"
ON public.repair_requests FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'ceo', 'general_manager', 'sales_manager', 'scaffold_executive_manager', 'executive_manager_scaffold_execution_with_materials', 'finance_manager')
  )
);

CREATE POLICY "Managers can update repair requests"
ON public.repair_requests FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'ceo', 'general_manager', 'sales_manager', 'scaffold_executive_manager', 'executive_manager_scaffold_execution_with_materials', 'finance_manager')
  )
);

-- RLS Policies for repair_request_media
CREATE POLICY "Users can view repair request media"
ON public.repair_request_media FOR SELECT
USING (
  repair_request_id IN (
    SELECT id FROM public.repair_requests 
    WHERE customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'ceo', 'general_manager', 'sales_manager', 'scaffold_executive_manager', 'executive_manager_scaffold_execution_with_materials', 'finance_manager')
  )
);

CREATE POLICY "Users can insert repair request media"
ON public.repair_request_media FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own repair request media"
ON public.repair_request_media FOR DELETE
USING (auth.uid() = user_id);

-- RLS Policies for repair_request_messages
CREATE POLICY "Users can view repair request messages"
ON public.repair_request_messages FOR SELECT
USING (
  repair_request_id IN (
    SELECT id FROM public.repair_requests 
    WHERE customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'ceo', 'general_manager', 'sales_manager', 'scaffold_executive_manager', 'executive_manager_scaffold_execution_with_materials', 'finance_manager')
  )
);

CREATE POLICY "Users can insert repair request messages"
ON public.repair_request_messages FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create indexes
CREATE INDEX idx_repair_requests_order_id ON public.repair_requests(order_id);
CREATE INDEX idx_repair_requests_customer_id ON public.repair_requests(customer_id);
CREATE INDEX idx_repair_requests_status ON public.repair_requests(status);
CREATE INDEX idx_repair_request_media_request_id ON public.repair_request_media(repair_request_id);
CREATE INDEX idx_repair_request_messages_request_id ON public.repair_request_messages(repair_request_id);

-- Add trigger for updated_at
CREATE TRIGGER update_repair_requests_updated_at
BEFORE UPDATE ON public.repair_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();