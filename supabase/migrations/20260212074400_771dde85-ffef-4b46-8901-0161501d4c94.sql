
-- Function to recalculate bank card balance
CREATE OR REPLACE FUNCTION public.recalculate_bank_card_balance(p_card_id uuid)
RETURNS void AS $$
DECLARE
  v_initial_balance numeric;
  v_tx_total numeric;
  v_staff_total numeric;
  v_new_balance numeric;
BEGIN
  -- Get initial balance
  SELECT initial_balance INTO v_initial_balance FROM public.bank_cards WHERE id = p_card_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- Sum from bank_card_transactions
  SELECT COALESCE(
    SUM(CASE WHEN transaction_type = 'deposit' THEN amount ELSE -amount END), 0
  ) INTO v_tx_total
  FROM public.bank_card_transactions WHERE bank_card_id = p_card_id;

  -- Sum from daily_report_staff (is_cash_box entries)
  SELECT COALESCE(
    SUM(COALESCE(amount_received, 0) - COALESCE(amount_spent, 0)), 0
  ) INTO v_staff_total
  FROM public.daily_report_staff WHERE bank_card_id = p_card_id AND is_cash_box = true;

  v_new_balance := v_initial_balance + v_tx_total + v_staff_total;

  UPDATE public.bank_cards SET current_balance = v_new_balance, updated_at = now() WHERE id = p_card_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger function for bank_cards table (initial_balance change)
CREATE OR REPLACE FUNCTION public.trigger_recalc_bank_card_on_update()
RETURNS trigger AS $$
BEGIN
  IF OLD.initial_balance IS DISTINCT FROM NEW.initial_balance THEN
    PERFORM public.recalculate_bank_card_balance(NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger function for bank_card_transactions
CREATE OR REPLACE FUNCTION public.trigger_recalc_bank_card_on_tx()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalculate_bank_card_balance(OLD.bank_card_id);
  ELSE
    PERFORM public.recalculate_bank_card_balance(NEW.bank_card_id);
    IF TG_OP = 'UPDATE' AND OLD.bank_card_id IS DISTINCT FROM NEW.bank_card_id THEN
      PERFORM public.recalculate_bank_card_balance(OLD.bank_card_id);
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger function for daily_report_staff
CREATE OR REPLACE FUNCTION public.trigger_recalc_bank_card_on_staff()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.bank_card_id IS NOT NULL AND OLD.is_cash_box = true THEN
      PERFORM public.recalculate_bank_card_balance(OLD.bank_card_id);
    END IF;
  ELSE
    IF NEW.bank_card_id IS NOT NULL AND NEW.is_cash_box = true THEN
      PERFORM public.recalculate_bank_card_balance(NEW.bank_card_id);
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.bank_card_id IS DISTINCT FROM NEW.bank_card_id AND OLD.bank_card_id IS NOT NULL THEN
      PERFORM public.recalculate_bank_card_balance(OLD.bank_card_id);
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create triggers
CREATE TRIGGER trg_bank_card_initial_balance
  AFTER UPDATE ON public.bank_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_recalc_bank_card_on_update();

CREATE TRIGGER trg_bank_card_tx_recalc
  AFTER INSERT OR UPDATE OR DELETE ON public.bank_card_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_recalc_bank_card_on_tx();

CREATE TRIGGER trg_bank_card_staff_recalc
  AFTER INSERT OR UPDATE OR DELETE ON public.daily_report_staff
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_recalc_bank_card_on_staff();

-- RPC for manual recalculation of all cards
CREATE OR REPLACE FUNCTION public.recalculate_all_bank_card_balances()
RETURNS void AS $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM public.bank_cards LOOP
    PERFORM public.recalculate_bank_card_balance(r.id);
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
