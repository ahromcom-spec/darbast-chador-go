CREATE TABLE public.payment_submissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid REFERENCES public.projects_v3(id) ON DELETE CASCADE,
  statement_id uuid,
  customer_id uuid,
  submitted_by uuid NOT NULL,
  kind text NOT NULL DEFAULT 'receipt',
  amount numeric NOT NULL CHECK (amount > 0),
  notes text,
  image_path text,
  cheque_serial text,
  cheque_due_date timestamptz,
  status text NOT NULL DEFAULT 'pending',
  bank_card_id uuid REFERENCES public.bank_cards(id) ON DELETE SET NULL,
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_notes text,
  order_payment_ids uuid[] DEFAULT '{}'::uuid[],
  transaction_id uuid,
  cheque_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_submissions_kind_check CHECK (kind IN ('receipt','cheque')),
  CONSTRAINT payment_submissions_status_check CHECK (status IN ('pending','approved','rejected'))
);

CREATE INDEX idx_payment_submissions_order ON public.payment_submissions(order_id);
CREATE INDEX idx_payment_submissions_statement ON public.payment_submissions(statement_id);
CREATE INDEX idx_payment_submissions_status ON public.payment_submissions(status);
CREATE INDEX idx_payment_submissions_submitted_by ON public.payment_submissions(submitted_by);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_submissions TO authenticated;
GRANT ALL ON public.payment_submissions TO service_role;

ALTER TABLE public.payment_submissions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_payment_reviewer(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.internal_staff_profiles isp
    WHERE isp.user_id = _uid AND isp.status = 'approved'
  )
  OR public.has_role(_uid, 'admin')
  OR public.has_role(_uid, 'general_manager')
  OR public.has_role(_uid, 'ceo')
  OR public.has_role(_uid, 'sales_manager')
  OR public.has_role(_uid, 'finance_manager')
  OR public.has_role(_uid, 'scaffold_executive_manager')
  OR public.has_role(_uid, 'executive_manager_scaffold_execution_with_materials')
  OR public.has_role(_uid, 'rental_executive_manager')
$$;

CREATE POLICY "Users can insert their own payment submissions"
ON public.payment_submissions FOR INSERT TO authenticated
WITH CHECK (submitted_by = auth.uid());

CREATE POLICY "Users can view their own payment submissions"
ON public.payment_submissions FOR SELECT TO authenticated
USING (submitted_by = auth.uid() OR public.is_payment_reviewer(auth.uid()));

CREATE POLICY "Users can delete their own pending submissions"
ON public.payment_submissions FOR DELETE TO authenticated
USING ((submitted_by = auth.uid() AND status = 'pending') OR public.is_payment_reviewer(auth.uid()));

CREATE POLICY "Reviewers can update payment submissions"
ON public.payment_submissions FOR UPDATE TO authenticated
USING (public.is_payment_reviewer(auth.uid()) OR (submitted_by = auth.uid() AND status = 'pending'))
WITH CHECK (public.is_payment_reviewer(auth.uid()) OR (submitted_by = auth.uid() AND status = 'pending'));

CREATE TRIGGER update_payment_submissions_updated_at
BEFORE UPDATE ON public.payment_submissions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.order_payments ADD COLUMN IF NOT EXISTS receipt_image_url text;

CREATE POLICY "Users can upload their own payment receipts"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'payment-receipts' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users and reviewers can view payment receipts"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'payment-receipts' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_payment_reviewer(auth.uid())));

CREATE POLICY "Users can delete their own payment receipts"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'payment-receipts' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_payment_reviewer(auth.uid())));