
-- Cheques table for managing cheque payments against statements
CREATE TABLE public.cheques (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_id uuid,
  customer_id uuid,
  bank_card_id uuid REFERENCES public.bank_cards(id) ON DELETE SET NULL,
  transaction_id uuid REFERENCES public.bank_card_transactions(id) ON DELETE SET NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  serial_number text NOT NULL,
  received_date timestamptz NOT NULL DEFAULT now(),
  due_date timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','cleared','bounced')),
  cleared_at timestamptz,
  bounced_at timestamptz,
  order_payment_ids uuid[] DEFAULT '{}',
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cheques TO authenticated;
GRANT ALL ON public.cheques TO service_role;

ALTER TABLE public.cheques ENABLE ROW LEVEL SECURITY;

-- Authenticated users can manage cheques (matches order_payments style)
CREATE POLICY "Authenticated can view cheques"
  ON public.cheques FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert cheques"
  ON public.cheques FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated can update cheques"
  ON public.cheques FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated can delete cheques"
  ON public.cheques FOR DELETE TO authenticated USING (true);

CREATE INDEX idx_cheques_statement ON public.cheques(statement_id);
CREATE INDEX idx_cheques_customer ON public.cheques(customer_id);
CREATE INDEX idx_cheques_card ON public.cheques(bank_card_id);
CREATE INDEX idx_cheques_status ON public.cheques(status);

CREATE TRIGGER update_cheques_updated_at
  BEFORE UPDATE ON public.cheques
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
