
-- Trigger function for bank_card_transactions
CREATE OR REPLACE FUNCTION public.trigger_recalculate_bank_card_balance_on_tx()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalculate_bank_card_balance(OLD.bank_card_id);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.recalculate_bank_card_balance(NEW.bank_card_id);
    IF OLD.bank_card_id IS DISTINCT FROM NEW.bank_card_id THEN
      PERFORM public.recalculate_bank_card_balance(OLD.bank_card_id);
    END IF;
    RETURN NEW;
  ELSE
    PERFORM public.recalculate_bank_card_balance(NEW.bank_card_id);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger function for daily_report_staff
CREATE OR REPLACE FUNCTION public.trigger_recalculate_bank_card_balance_on_staff()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.bank_card_id IS NOT NULL AND OLD.is_cash_box = true THEN
      PERFORM public.recalculate_bank_card_balance(OLD.bank_card_id);
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.bank_card_id IS NOT NULL AND NEW.is_cash_box = true THEN
      PERFORM public.recalculate_bank_card_balance(NEW.bank_card_id);
    END IF;
    IF OLD.bank_card_id IS NOT NULL AND OLD.is_cash_box = true AND OLD.bank_card_id IS DISTINCT FROM NEW.bank_card_id THEN
      PERFORM public.recalculate_bank_card_balance(OLD.bank_card_id);
    END IF;
    RETURN NEW;
  ELSE
    IF NEW.bank_card_id IS NOT NULL AND NEW.is_cash_box = true THEN
      PERFORM public.recalculate_bank_card_balance(NEW.bank_card_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger function for bank_cards (initial_balance change)
CREATE OR REPLACE FUNCTION public.trigger_recalculate_on_initial_balance_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.initial_balance IS DISTINCT FROM NEW.initial_balance THEN
    PERFORM public.recalculate_bank_card_balance(NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create triggers
CREATE TRIGGER trg_recalc_balance_on_tx
  AFTER INSERT OR UPDATE OR DELETE ON public.bank_card_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_recalculate_bank_card_balance_on_tx();

CREATE TRIGGER trg_recalc_balance_on_staff
  AFTER INSERT OR UPDATE OR DELETE ON public.daily_report_staff
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_recalculate_bank_card_balance_on_staff();

CREATE TRIGGER trg_recalc_balance_on_initial
  AFTER UPDATE ON public.bank_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_recalculate_on_initial_balance_change();
