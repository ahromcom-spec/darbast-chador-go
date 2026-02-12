
-- Fix: Only trigger recalculation when initial_balance changes, not current_balance
DROP TRIGGER IF EXISTS trg_bank_card_initial_balance ON public.bank_cards;

CREATE OR REPLACE FUNCTION public.trigger_recalc_bank_card_on_update()
RETURNS trigger AS $$
BEGIN
  -- Only recalculate if initial_balance changed (not current_balance to avoid recursion)
  IF OLD.initial_balance IS DISTINCT FROM NEW.initial_balance THEN
    -- Calculate inline to avoid recursive trigger
    NEW.current_balance := NEW.initial_balance + 
      COALESCE((SELECT SUM(CASE WHEN transaction_type = 'deposit' THEN amount ELSE -amount END) FROM public.bank_card_transactions WHERE bank_card_id = NEW.id), 0) +
      COALESCE((SELECT SUM(COALESCE(amount_received, 0) - COALESCE(amount_spent, 0)) FROM public.daily_report_staff WHERE bank_card_id = NEW.id AND is_cash_box = true), 0);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Use BEFORE UPDATE to modify NEW directly (avoids recursive UPDATE)
CREATE TRIGGER trg_bank_card_initial_balance
  BEFORE UPDATE ON public.bank_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_recalc_bank_card_on_update();
