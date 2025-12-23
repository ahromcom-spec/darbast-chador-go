-- Function to add order cost to customer wallet when order is approved
CREATE OR REPLACE FUNCTION public.sync_order_approval_to_wallet()
RETURNS TRIGGER AS $$
DECLARE
  v_customer_user_id uuid;
  v_order_code text;
BEGIN
  -- Only proceed if:
  -- 1. Status changed to 'approved'
  -- 2. Order has a total_price > 0
  -- 3. This is an actual status change (not just any update)
  IF NEW.status = 'approved' 
     AND (OLD.status IS NULL OR OLD.status != 'approved')
     AND NEW.total_price IS NOT NULL 
     AND NEW.total_price > 0 THEN
    
    -- Get the user_id from the customer
    SELECT user_id INTO v_customer_user_id
    FROM public.customers
    WHERE id = NEW.customer_id;
    
    IF v_customer_user_id IS NOT NULL THEN
      v_order_code := NEW.code;
      
      -- Check if this order already has a wallet transaction (prevent duplicates)
      IF NOT EXISTS (
        SELECT 1 FROM public.wallet_transactions 
        WHERE reference_type = 'order_approved' 
        AND reference_id = NEW.id
      ) THEN
        -- Insert as a debit (negative amount = debt to company)
        INSERT INTO public.wallet_transactions (
          user_id,
          transaction_type,
          amount,
          title,
          description,
          reference_type,
          reference_id
        ) VALUES (
          v_customer_user_id,
          'debit',
          -NEW.total_price,  -- Negative because it's a debt
          'هزینه سفارش ' || COALESCE(v_order_code, NEW.id::text),
          'بدهی سفارش تایید شده به شماره ' || COALESCE(v_order_code, NEW.id::text),
          'order_approved',
          NEW.id
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for order approval
DROP TRIGGER IF EXISTS on_order_approved_wallet ON public.projects_v3;
CREATE TRIGGER on_order_approved_wallet
  AFTER UPDATE ON public.projects_v3
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_order_approval_to_wallet();

-- Also handle payment - when customer pays, add positive transaction
CREATE OR REPLACE FUNCTION public.sync_order_payment_to_wallet()
RETURNS TRIGGER AS $$
DECLARE
  v_customer_user_id uuid;
  v_order_code text;
  v_order_id uuid;
BEGIN
  -- Get order info
  SELECT p.customer_id, p.code, p.id, c.user_id 
  INTO v_order_id, v_order_code, v_order_id, v_customer_user_id
  FROM public.projects_v3 p
  JOIN public.customers c ON c.id = p.customer_id
  WHERE p.id = NEW.order_id;
  
  IF v_customer_user_id IS NOT NULL THEN
    -- Check if this payment already has a wallet transaction
    IF NOT EXISTS (
      SELECT 1 FROM public.wallet_transactions 
      WHERE reference_type = 'order_payment' 
      AND reference_id = NEW.id
    ) THEN
      -- Insert as credit (positive amount = reduces debt)
      INSERT INTO public.wallet_transactions (
        user_id,
        transaction_type,
        amount,
        title,
        description,
        reference_type,
        reference_id
      ) VALUES (
        v_customer_user_id,
        'credit',
        NEW.amount,  -- Positive because it's a payment
        'پرداخت سفارش ' || COALESCE(v_order_code, NEW.order_id::text),
        'پرداخت برای سفارش شماره ' || COALESCE(v_order_code, NEW.order_id::text),
        'order_payment',
        NEW.id
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for order payments
DROP TRIGGER IF EXISTS on_order_payment_wallet ON public.order_payments;
CREATE TRIGGER on_order_payment_wallet
  AFTER INSERT ON public.order_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_order_payment_to_wallet();