
-- 1) Table
CREATE TABLE public.customer_statements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  statement_number int NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  total_amount numeric NOT NULL DEFAULT 0,
  total_paid numeric NOT NULL DEFAULT 0,
  closed_at timestamptz,
  closed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_id, statement_number)
);

CREATE INDEX idx_customer_statements_customer ON public.customer_statements(customer_id);
CREATE INDEX idx_customer_statements_status ON public.customer_statements(status);

-- 2) Add statement_id column on projects_v3
ALTER TABLE public.projects_v3
  ADD COLUMN statement_id uuid REFERENCES public.customer_statements(id) ON DELETE SET NULL;

CREATE INDEX idx_projects_v3_statement_id ON public.projects_v3(statement_id);

-- 3) Updated-at trigger
CREATE TRIGGER trg_customer_statements_updated_at
  BEFORE UPDATE ON public.customer_statements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4) Function: get or create open statement for customer
CREATE OR REPLACE FUNCTION public.get_or_create_open_statement(_customer_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_next_number int;
BEGIN
  SELECT id INTO v_id
  FROM public.customer_statements
  WHERE customer_id = _customer_id AND status = 'open'
  ORDER BY statement_number DESC
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  SELECT COALESCE(MAX(statement_number), 0) + 1 INTO v_next_number
  FROM public.customer_statements
  WHERE customer_id = _customer_id;

  INSERT INTO public.customer_statements (customer_id, statement_number, status)
  VALUES (_customer_id, v_next_number, 'open')
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- 5) Function: close statement and open the next one
CREATE OR REPLACE FUNCTION public.close_customer_statement(_statement_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer uuid;
  v_status text;
  v_next_number int;
  v_new_id uuid;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'ceo'::app_role) OR
    public.has_role(auth.uid(), 'general_manager'::app_role) OR
    public.has_role(auth.uid(), 'finance_manager'::app_role) OR
    public.has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR
    public.has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role) OR
    public.has_role(auth.uid(), 'rental_executive_manager'::app_role)
  ) THEN
    RAISE EXCEPTION 'دسترسی غیرمجاز برای بستن صورتحساب';
  END IF;

  SELECT customer_id, status INTO v_customer, v_status
  FROM public.customer_statements WHERE id = _statement_id;

  IF v_customer IS NULL THEN
    RAISE EXCEPTION 'صورتحساب پیدا نشد';
  END IF;

  IF v_status = 'closed' THEN
    RETURN _statement_id;
  END IF;

  UPDATE public.customer_statements
  SET status = 'closed', closed_at = now(), closed_by = auth.uid()
  WHERE id = _statement_id;

  SELECT COALESCE(MAX(statement_number), 0) + 1 INTO v_next_number
  FROM public.customer_statements WHERE customer_id = v_customer;

  INSERT INTO public.customer_statements (customer_id, statement_number, status)
  VALUES (v_customer, v_next_number, 'open')
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

-- 6) Function: recalc statement totals from its orders
CREATE OR REPLACE FUNCTION public.recalc_customer_statement(_statement_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _statement_id IS NULL THEN RETURN; END IF;
  UPDATE public.customer_statements s
  SET
    total_amount = COALESCE(t.total_amount, 0),
    total_paid = COALESCE(t.total_paid, 0)
  FROM (
    SELECT
      COALESCE(SUM(COALESCE(p.total_price, p.payment_amount, 0)), 0) AS total_amount,
      COALESCE(SUM(COALESCE(p.total_paid, 0)), 0) AS total_paid
    FROM public.projects_v3 p
    WHERE p.statement_id = _statement_id
  ) t
  WHERE s.id = _statement_id;
END;
$$;

-- 7) Trigger function on projects_v3: assign statement & recalc
CREATE OR REPLACE FUNCTION public.trigger_assign_order_statement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_statement_id uuid;
  v_old_statement uuid;
  v_eligible boolean;
BEGIN
  v_eligible := NEW.customer_id IS NOT NULL
                AND COALESCE(NEW.status::text, '') <> 'rejected'
                AND COALESCE(NEW.is_archived, false) = false
                AND COALESCE(NEW.is_deep_archived, false) = false;

  IF v_eligible AND NEW.statement_id IS NULL THEN
    v_statement_id := public.get_or_create_open_statement(NEW.customer_id);
    NEW.statement_id := v_statement_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_projects_v3_assign_statement
  BEFORE INSERT OR UPDATE OF status, customer_id, is_archived, is_deep_archived
  ON public.projects_v3
  FOR EACH ROW EXECUTE FUNCTION public.trigger_assign_order_statement();

-- 8) Trigger function: recalc statement totals after order change
CREATE OR REPLACE FUNCTION public.trigger_recalc_statement_on_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_customer_statement(OLD.statement_id);
    RETURN OLD;
  END IF;
  PERFORM public.recalc_customer_statement(NEW.statement_id);
  IF TG_OP = 'UPDATE' AND OLD.statement_id IS DISTINCT FROM NEW.statement_id THEN
    PERFORM public.recalc_customer_statement(OLD.statement_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_projects_v3_recalc_statement
  AFTER INSERT OR UPDATE OF total_price, payment_amount, total_paid, statement_id, status, is_archived, is_deep_archived
  OR DELETE
  ON public.projects_v3
  FOR EACH ROW EXECUTE FUNCTION public.trigger_recalc_statement_on_order();

-- 9) RLS
ALTER TABLE public.customer_statements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can view their statements"
  ON public.customer_statements FOR SELECT
  USING (
    customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())
  );

CREATE POLICY "Managers can view all statements"
  ON public.customer_statements FOR SELECT
  USING (
    public.has_role(auth.uid(), 'ceo'::app_role) OR
    public.has_role(auth.uid(), 'general_manager'::app_role) OR
    public.has_role(auth.uid(), 'finance_manager'::app_role) OR
    public.has_role(auth.uid(), 'sales_manager'::app_role) OR
    public.has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR
    public.has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role) OR
    public.has_role(auth.uid(), 'rental_executive_manager'::app_role) OR
    public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Managers can update statements"
  ON public.customer_statements FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'ceo'::app_role) OR
    public.has_role(auth.uid(), 'general_manager'::app_role) OR
    public.has_role(auth.uid(), 'finance_manager'::app_role) OR
    public.has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR
    public.has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role) OR
    public.has_role(auth.uid(), 'rental_executive_manager'::app_role) OR
    public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Managers can insert statements"
  ON public.customer_statements FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'ceo'::app_role) OR
    public.has_role(auth.uid(), 'general_manager'::app_role) OR
    public.has_role(auth.uid(), 'finance_manager'::app_role) OR
    public.has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR
    public.has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role) OR
    public.has_role(auth.uid(), 'rental_executive_manager'::app_role) OR
    public.has_role(auth.uid(), 'admin'::app_role)
  );

-- 10) Backfill: assign all eligible existing orders to statement #1 of each customer
DO $$
DECLARE
  r RECORD;
  v_statement_id uuid;
BEGIN
  FOR r IN
    SELECT DISTINCT customer_id
    FROM public.projects_v3
    WHERE customer_id IS NOT NULL
      AND COALESCE(status::text, '') <> 'rejected'
      AND COALESCE(is_archived, false) = false
      AND COALESCE(is_deep_archived, false) = false
      AND statement_id IS NULL
  LOOP
    SELECT public.get_or_create_open_statement(r.customer_id) INTO v_statement_id;
    UPDATE public.projects_v3
    SET statement_id = v_statement_id
    WHERE customer_id = r.customer_id
      AND statement_id IS NULL
      AND COALESCE(status::text, '') <> 'rejected'
      AND COALESCE(is_archived, false) = false
      AND COALESCE(is_deep_archived, false) = false;
    PERFORM public.recalc_customer_statement(v_statement_id);
  END LOOP;
END $$;
