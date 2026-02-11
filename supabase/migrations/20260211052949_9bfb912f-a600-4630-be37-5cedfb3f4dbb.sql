
-- Update wallet sync trigger to also track total_price changes (renewals update total_price)
CREATE OR REPLACE FUNCTION public.sync_order_approval_to_wallet()
RETURNS TRIGGER AS $$
DECLARE
  v_customer_user_id uuid;
  v_order_code text;
  v_price numeric;
BEGIN
  -- Priority: total_price (includes renewals/repairs) then payment_amount
  v_price := COALESCE(NULLIF(NEW.total_price, 0), NEW.payment_amount, 0);
  
  -- Case 1: Order is newly approved - create wallet transaction
  IF NEW.status = 'approved' 
     AND (OLD.status IS NULL OR OLD.status != 'approved')
     AND v_price > 0 THEN
    
    SELECT user_id INTO v_customer_user_id
    FROM public.customers
    WHERE id = NEW.customer_id;
    
    IF v_customer_user_id IS NOT NULL THEN
      v_order_code := NEW.code;
      
      IF NOT EXISTS (
        SELECT 1 FROM public.wallet_transactions 
        WHERE reference_type = 'order_approved' 
        AND reference_id = NEW.id
      ) THEN
        INSERT INTO public.wallet_transactions (
          user_id, transaction_type, amount, title, description, reference_type, reference_id
        ) VALUES (
          v_customer_user_id, 'debit', -v_price,
          'هزینه سفارش ' || COALESCE(v_order_code, NEW.id::text),
          'بدهی سفارش تایید شده به شماره ' || COALESCE(v_order_code, NEW.id::text),
          'order_approved', NEW.id
        );
      END IF;
    END IF;
  
  -- Case 2: Price changed (payment_amount OR total_price) on active order
  ELSIF (NEW.status IN ('approved', 'completed', 'in_progress', 'scheduled', 'active', 'paid', 'closed'))
     AND v_price > 0
     AND (
       (OLD.payment_amount IS DISTINCT FROM NEW.payment_amount)
       OR (OLD.total_price IS DISTINCT FROM NEW.total_price)
     ) THEN
    
    SELECT user_id INTO v_customer_user_id
    FROM public.customers
    WHERE id = NEW.customer_id;
    
    IF v_customer_user_id IS NOT NULL THEN
      v_order_code := NEW.code;
      
      IF EXISTS (
        SELECT 1 FROM public.wallet_transactions 
        WHERE reference_type = 'order_approved' 
        AND reference_id = NEW.id
      ) THEN
        UPDATE public.wallet_transactions
        SET 
          amount = -v_price,
          description = 'بدهی سفارش به شماره ' || COALESCE(v_order_code, NEW.id::text) || ' (بروزرسانی شده)',
          updated_at = now()
        WHERE reference_type = 'order_approved' 
        AND reference_id = NEW.id;
      ELSE
        INSERT INTO public.wallet_transactions (
          user_id, transaction_type, amount, title, description, reference_type, reference_id
        ) VALUES (
          v_customer_user_id, 'debit', -v_price,
          'هزینه سفارش ' || COALESCE(v_order_code, NEW.id::text),
          'بدهی سفارش به شماره ' || COALESCE(v_order_code, NEW.id::text),
          'order_approved', NEW.id
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Now fix the existing wallet transaction for Hosseini's order (code 1000224)
-- Update the wallet debit to match total_price
UPDATE public.wallet_transactions wt
SET 
  amount = -p.total_price,
  description = 'بدهی سفارش به شماره ' || p.code || ' (بروزرسانی شده)',
  updated_at = now()
FROM public.projects_v3 p
WHERE wt.reference_type = 'order_approved'
  AND wt.reference_id = p.id
  AND p.code = '1000224'
  AND p.total_price IS NOT NULL
  AND p.total_price > 0;
