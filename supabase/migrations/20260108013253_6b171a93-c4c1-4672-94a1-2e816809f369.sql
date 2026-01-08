-- Update trigger to use payment_amount instead of total_price
-- And also update wallet transaction when payment_amount changes

CREATE OR REPLACE FUNCTION public.sync_order_approval_to_wallet()
RETURNS TRIGGER AS $$
DECLARE
  v_customer_user_id uuid;
  v_order_code text;
  v_price numeric;
BEGIN
  -- Use payment_amount as the primary price field (fallback to total_price)
  v_price := COALESCE(NEW.payment_amount, NEW.total_price, 0);
  
  -- Case 1: Order is newly approved - create wallet transaction
  IF NEW.status = 'approved' 
     AND (OLD.status IS NULL OR OLD.status != 'approved')
     AND v_price > 0 THEN
    
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
          -v_price,
          'هزینه سفارش ' || COALESCE(v_order_code, NEW.id::text),
          'بدهی سفارش تایید شده به شماره ' || COALESCE(v_order_code, NEW.id::text),
          'order_approved',
          NEW.id
        );
      END IF;
    END IF;
  
  -- Case 2: Price changed on an approved/completed/in_progress/scheduled order - update existing wallet transaction
  ELSIF (NEW.status IN ('approved', 'completed', 'in_progress', 'scheduled', 'active', 'paid', 'closed'))
     AND v_price > 0
     AND (OLD.payment_amount IS NULL OR OLD.payment_amount != NEW.payment_amount) THEN
    
    -- Get the user_id from the customer
    SELECT user_id INTO v_customer_user_id
    FROM public.customers
    WHERE id = NEW.customer_id;
    
    IF v_customer_user_id IS NOT NULL THEN
      v_order_code := NEW.code;
      
      -- Check if wallet transaction exists for this order
      IF EXISTS (
        SELECT 1 FROM public.wallet_transactions 
        WHERE reference_type = 'order_approved' 
        AND reference_id = NEW.id
      ) THEN
        -- Update existing transaction with new price
        UPDATE public.wallet_transactions
        SET 
          amount = -v_price,
          description = 'بدهی سفارش به شماره ' || COALESCE(v_order_code, NEW.id::text) || ' (بروزرسانی شده)',
          updated_at = now()
        WHERE reference_type = 'order_approved' 
        AND reference_id = NEW.id;
      ELSE
        -- Create new transaction if it doesn't exist (for orders that were approved before this trigger)
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
          -v_price,
          'هزینه سفارش ' || COALESCE(v_order_code, NEW.id::text),
          'بدهی سفارش به شماره ' || COALESCE(v_order_code, NEW.id::text),
          'order_approved',
          NEW.id
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Sync total_price with payment_amount for consistency
UPDATE public.projects_v3
SET total_price = payment_amount
WHERE payment_amount > 0 AND (total_price IS NULL OR total_price = 0);