-- Create table for order payments (multi-installment payments)
CREATE TABLE public.order_payments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES public.projects_v3(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    payment_method TEXT DEFAULT 'cash',
    receipt_number TEXT,
    notes TEXT,
    paid_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.order_payments ENABLE ROW LEVEL SECURITY;

-- Create policy for staff to view all payments
CREATE POLICY "Staff can view all order payments"
ON public.order_payments
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.internal_staff_profiles
        WHERE user_id = auth.uid() AND status = 'approved'
    )
);

-- Create policy for staff to insert payments
CREATE POLICY "Staff can insert order payments"
ON public.order_payments
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.internal_staff_profiles
        WHERE user_id = auth.uid() AND status = 'approved'
    )
);

-- Create policy for customers to view their order payments
CREATE POLICY "Customers can view their order payments"
ON public.order_payments
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.projects_v3 p
        JOIN public.customers c ON p.customer_id = c.id
        WHERE p.id = order_id AND c.user_id = auth.uid()
    )
);

-- Add total_price column to projects_v3 for storing order total
ALTER TABLE public.projects_v3 ADD COLUMN IF NOT EXISTS total_price NUMERIC DEFAULT 0;

-- Add total_paid column to projects_v3 for quick access to total paid amount
ALTER TABLE public.projects_v3 ADD COLUMN IF NOT EXISTS total_paid NUMERIC DEFAULT 0;