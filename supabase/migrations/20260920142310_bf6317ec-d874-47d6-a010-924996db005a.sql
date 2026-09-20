ALTER TABLE public.customer_statements
  ADD COLUMN IF NOT EXISTS discount_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_note text;

CREATE TABLE IF NOT EXISTS public.customer_global_discounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL UNIQUE REFERENCES public.customers(id) ON DELETE CASCADE,
  discount_amount numeric NOT NULL DEFAULT 0,
  discount_note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_global_discounts TO authenticated;
GRANT ALL ON public.customer_global_discounts TO service_role;

ALTER TABLE public.customer_global_discounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can view their global discount"
ON public.customer_global_discounts FOR SELECT TO authenticated
USING (customer_id IN (SELECT c.id FROM public.customers c WHERE c.user_id = auth.uid()));

CREATE POLICY "Managers can view global discounts"
ON public.customer_global_discounts FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'ceo') OR has_role(auth.uid(), 'general_manager') OR has_role(auth.uid(), 'finance_manager')
  OR has_role(auth.uid(), 'sales_manager') OR has_role(auth.uid(), 'scaffold_executive_manager')
  OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials')
  OR has_role(auth.uid(), 'rental_executive_manager') OR has_role(auth.uid(), 'admin')
);

CREATE POLICY "Managers can insert global discounts"
ON public.customer_global_discounts FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'ceo') OR has_role(auth.uid(), 'general_manager') OR has_role(auth.uid(), 'finance_manager')
  OR has_role(auth.uid(), 'scaffold_executive_manager')
  OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials')
  OR has_role(auth.uid(), 'rental_executive_manager') OR has_role(auth.uid(), 'admin')
);

CREATE POLICY "Managers can update global discounts"
ON public.customer_global_discounts FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'ceo') OR has_role(auth.uid(), 'general_manager') OR has_role(auth.uid(), 'finance_manager')
  OR has_role(auth.uid(), 'scaffold_executive_manager')
  OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials')
  OR has_role(auth.uid(), 'rental_executive_manager') OR has_role(auth.uid(), 'admin')
);

CREATE POLICY "Managers can delete global discounts"
ON public.customer_global_discounts FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'ceo') OR has_role(auth.uid(), 'general_manager') OR has_role(auth.uid(), 'finance_manager')
  OR has_role(auth.uid(), 'admin')
);

CREATE TRIGGER trg_customer_global_discounts_updated_at
BEFORE UPDATE ON public.customer_global_discounts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();