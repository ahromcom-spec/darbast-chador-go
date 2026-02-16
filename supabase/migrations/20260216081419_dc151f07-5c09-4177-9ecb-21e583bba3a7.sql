
-- Add payment_date column for manual date entry
ALTER TABLE public.order_payments ADD COLUMN payment_date timestamptz DEFAULT now();

-- Update existing records to use created_at as payment_date
UPDATE public.order_payments SET payment_date = created_at WHERE payment_date IS NULL;

-- Add UPDATE policy for staff/managers
CREATE POLICY "Staff and managers can update order payments"
ON public.order_payments
FOR UPDATE
USING (
  (EXISTS (SELECT 1 FROM internal_staff_profiles isp WHERE isp.user_id = auth.uid() AND isp.status = 'approved'))
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'general_manager'::app_role)
  OR has_role(auth.uid(), 'ceo'::app_role)
  OR has_role(auth.uid(), 'sales_manager'::app_role)
  OR has_role(auth.uid(), 'finance_manager'::app_role)
  OR has_role(auth.uid(), 'scaffold_executive_manager'::app_role)
  OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role)
  OR has_role(auth.uid(), 'rental_executive_manager'::app_role)
);

-- Add DELETE policy for staff/managers
CREATE POLICY "Staff and managers can delete order payments"
ON public.order_payments
FOR DELETE
USING (
  (EXISTS (SELECT 1 FROM internal_staff_profiles isp WHERE isp.user_id = auth.uid() AND isp.status = 'approved'))
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'general_manager'::app_role)
  OR has_role(auth.uid(), 'ceo'::app_role)
  OR has_role(auth.uid(), 'sales_manager'::app_role)
  OR has_role(auth.uid(), 'finance_manager'::app_role)
  OR has_role(auth.uid(), 'scaffold_executive_manager'::app_role)
  OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role)
  OR has_role(auth.uid(), 'rental_executive_manager'::app_role)
);
