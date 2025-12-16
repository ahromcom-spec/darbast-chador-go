
-- Create expert pricing requests table for customers to request pricing from experts
CREATE TABLE public.expert_pricing_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  subcategory_id UUID NOT NULL REFERENCES public.subcategories(id),
  province_id UUID NOT NULL REFERENCES public.provinces(id),
  district_id UUID REFERENCES public.districts(id),
  address TEXT NOT NULL,
  detailed_address TEXT,
  location_lat DOUBLE PRECISION,
  location_lng DOUBLE PRECISION,
  description TEXT,
  dimensions JSONB,
  requested_date TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  unit_price NUMERIC,
  total_price NUMERIC,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  assigned_expert_id UUID,
  expert_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create media table for expert pricing requests
CREATE TABLE public.expert_pricing_request_media (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES public.expert_pricing_requests(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'image',
  file_size INTEGER,
  mime_type TEXT,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.expert_pricing_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expert_pricing_request_media ENABLE ROW LEVEL SECURITY;

-- RLS policies for expert_pricing_requests
CREATE POLICY "Customers can create own pricing requests"
ON public.expert_pricing_requests
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM customers c WHERE c.id = customer_id AND c.user_id = auth.uid()
));

CREATE POLICY "Customers can view own pricing requests"
ON public.expert_pricing_requests
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM customers c WHERE c.id = customer_id AND c.user_id = auth.uid()
));

CREATE POLICY "Customers can update own pending pricing requests"
ON public.expert_pricing_requests
FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM customers c WHERE c.id = customer_id AND c.user_id = auth.uid())
  AND status = 'pending'
);

CREATE POLICY "Managers can view all pricing requests"
ON public.expert_pricing_requests
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'ceo'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'sales_manager'::app_role) OR
  has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR
  has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role) OR
  has_role(auth.uid(), 'rental_executive_manager'::app_role)
);

CREATE POLICY "Managers can update pricing requests"
ON public.expert_pricing_requests
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'ceo'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'sales_manager'::app_role) OR
  has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR
  has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role) OR
  has_role(auth.uid(), 'rental_executive_manager'::app_role)
);

-- RLS policies for expert_pricing_request_media
CREATE POLICY "Users can insert own media"
ON public.expert_pricing_request_media
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view media for own requests"
ON public.expert_pricing_request_media
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM expert_pricing_requests epr
    JOIN customers c ON c.id = epr.customer_id
    WHERE epr.id = request_id AND c.user_id = auth.uid()
  ) OR
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'ceo'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'sales_manager'::app_role) OR
  has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR
  has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role) OR
  has_role(auth.uid(), 'rental_executive_manager'::app_role)
);

CREATE POLICY "Users can delete own media"
ON public.expert_pricing_request_media
FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_expert_pricing_requests_updated_at
BEFORE UPDATE ON public.expert_pricing_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
