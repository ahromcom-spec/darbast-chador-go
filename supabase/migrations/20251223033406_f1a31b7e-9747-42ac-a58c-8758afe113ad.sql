-- Create wallet transactions table
CREATE TABLE public.wallet_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL, -- 'salary', 'overtime', 'invoice_debt', 'payment', 'expense', 'income', 'adjustment'
  amount NUMERIC NOT NULL, -- positive for income/credit, negative for expense/debt
  balance_after NUMERIC, -- calculated balance after this transaction
  title TEXT NOT NULL,
  description TEXT,
  reference_type TEXT, -- 'daily_report_staff', 'order', 'order_payment', 'invoice', 'manual'
  reference_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

-- Users can view their own wallet transactions
CREATE POLICY "Users can view their own wallet transactions"
ON public.wallet_transactions
FOR SELECT
USING (auth.uid() = user_id);

-- CEO and managers can view all wallet transactions
CREATE POLICY "Managers can view all wallet transactions"
ON public.wallet_transactions
FOR SELECT
USING (
  has_role(auth.uid(), 'ceo'::app_role) 
  OR has_role(auth.uid(), 'general_manager'::app_role)
);

-- Only system/managers can insert wallet transactions
CREATE POLICY "Managers can insert wallet transactions"
ON public.wallet_transactions
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'ceo'::app_role) 
  OR has_role(auth.uid(), 'general_manager'::app_role)
  OR has_role(auth.uid(), 'scaffold_executive_manager'::app_role)
  OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role)
);

-- Create index for faster queries
CREATE INDEX idx_wallet_transactions_user_id ON public.wallet_transactions(user_id);
CREATE INDEX idx_wallet_transactions_created_at ON public.wallet_transactions(created_at DESC);
CREATE INDEX idx_wallet_transactions_type ON public.wallet_transactions(transaction_type);

-- Create a function to calculate wallet balance
CREATE OR REPLACE FUNCTION public.get_wallet_balance(_user_id UUID)
RETURNS NUMERIC
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(amount), 0)
  FROM public.wallet_transactions
  WHERE user_id = _user_id;
$$;

-- Create a function to add wallet transaction and update balance
CREATE OR REPLACE FUNCTION public.add_wallet_transaction(
  _user_id UUID,
  _transaction_type TEXT,
  _amount NUMERIC,
  _title TEXT,
  _description TEXT DEFAULT NULL,
  _reference_type TEXT DEFAULT NULL,
  _reference_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _transaction_id UUID;
  _current_balance NUMERIC;
BEGIN
  -- Calculate current balance
  SELECT COALESCE(SUM(amount), 0) INTO _current_balance
  FROM public.wallet_transactions
  WHERE user_id = _user_id;

  -- Insert transaction
  INSERT INTO public.wallet_transactions (
    user_id,
    transaction_type,
    amount,
    balance_after,
    title,
    description,
    reference_type,
    reference_id
  ) VALUES (
    _user_id,
    _transaction_type,
    _amount,
    _current_balance + _amount,
    _title,
    _description,
    _reference_type,
    _reference_id
  ) RETURNING id INTO _transaction_id;

  RETURN _transaction_id;
END;
$$;

-- Create trigger to auto-sync daily report staff entries to wallet
CREATE OR REPLACE FUNCTION public.sync_daily_report_to_wallet()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID;
  _report_date DATE;
BEGIN
  -- Only process if staff_user_id is set
  IF NEW.staff_user_id IS NOT NULL THEN
    _user_id := NEW.staff_user_id;
    
    -- Get report date
    SELECT report_date INTO _report_date
    FROM public.daily_reports
    WHERE id = NEW.daily_report_id;

    -- Add income transaction if amount_received > 0
    IF COALESCE(NEW.amount_received, 0) > 0 THEN
      -- Check if transaction already exists
      IF NOT EXISTS (
        SELECT 1 FROM public.wallet_transactions 
        WHERE reference_type = 'daily_report_staff' 
        AND reference_id = NEW.id 
        AND transaction_type = 'income'
      ) THEN
        PERFORM public.add_wallet_transaction(
          _user_id,
          'income',
          NEW.amount_received,
          'دریافتی - ' || COALESCE(_report_date::TEXT, ''),
          NEW.receiving_notes,
          'daily_report_staff',
          NEW.id
        );
      END IF;
    END IF;

    -- Add expense transaction if amount_spent > 0
    IF COALESCE(NEW.amount_spent, 0) > 0 THEN
      -- Check if transaction already exists
      IF NOT EXISTS (
        SELECT 1 FROM public.wallet_transactions 
        WHERE reference_type = 'daily_report_staff' 
        AND reference_id = NEW.id 
        AND transaction_type = 'expense'
      ) THEN
        PERFORM public.add_wallet_transaction(
          _user_id,
          'expense',
          -NEW.amount_spent,
          'پرداختی - ' || COALESCE(_report_date::TEXT, ''),
          NEW.spending_notes,
          'daily_report_staff',
          NEW.id
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for daily report staff
CREATE TRIGGER sync_wallet_on_daily_report_staff
AFTER INSERT OR UPDATE ON public.daily_report_staff
FOR EACH ROW
EXECUTE FUNCTION public.sync_daily_report_to_wallet();

-- Create trigger to sync order payments to wallet
CREATE OR REPLACE FUNCTION public.sync_order_payment_to_wallet()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _customer_user_id UUID;
  _order_code TEXT;
BEGIN
  -- Get customer user_id from order
  SELECT c.user_id, p.code INTO _customer_user_id, _order_code
  FROM public.projects_v3 p
  JOIN public.customers c ON c.id = p.customer_id
  WHERE p.id = NEW.order_id;

  IF _customer_user_id IS NOT NULL THEN
    -- Add payment as credit (reduces debt)
    PERFORM public.add_wallet_transaction(
      _customer_user_id,
      'payment',
      NEW.amount,
      'پرداخت فاکتور - سفارش ' || COALESCE(_order_code, ''),
      NEW.notes,
      'order_payment',
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for order payments
CREATE TRIGGER sync_wallet_on_order_payment
AFTER INSERT ON public.order_payments
FOR EACH ROW
EXECUTE FUNCTION public.sync_order_payment_to_wallet();