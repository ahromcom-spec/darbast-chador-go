
-- اصلاح تابع محاسبه موجودی کارت بانکی
-- مشکل: تابع قبلی هم از bank_card_transactions و هم از daily_report_staff محاسبه می‌کرد
-- که باعث دوبرابر شدن مبالغ گزارشات روزانه می‌شد
-- راه‌حل: فقط از bank_card_transactions حساب کنیم چون تمام رویدادها (از جمله گزارشات) در آن ثبت می‌شوند

CREATE OR REPLACE FUNCTION public.recalculate_bank_card_balance(p_card_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_initial_balance numeric;
  v_tx_total numeric;
  v_new_balance numeric;
BEGIN
  -- Get initial balance
  SELECT initial_balance INTO v_initial_balance FROM public.bank_cards WHERE id = p_card_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- Sum ONLY from bank_card_transactions (all sources including daily_report_staff are recorded here)
  SELECT COALESCE(
    SUM(CASE WHEN transaction_type = 'deposit' THEN amount ELSE -amount END), 0
  ) INTO v_tx_total
  FROM public.bank_card_transactions WHERE bank_card_id = p_card_id;

  v_new_balance := v_initial_balance + v_tx_total;

  UPDATE public.bank_cards SET current_balance = v_new_balance, updated_at = now() WHERE id = p_card_id;
END;
$$;

-- همچنین trigger_recalc_bank_card_on_update را اصلاح می‌کنیم
CREATE OR REPLACE FUNCTION public.trigger_recalc_bank_card_on_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  -- Only recalculate if initial_balance changed (not current_balance to avoid recursion)
  IF OLD.initial_balance IS DISTINCT FROM NEW.initial_balance THEN
    -- Calculate inline to avoid recursive trigger - ONLY from bank_card_transactions
    NEW.current_balance := NEW.initial_balance + 
      COALESCE((SELECT SUM(CASE WHEN transaction_type = 'deposit' THEN amount ELSE -amount END) 
                FROM public.bank_card_transactions WHERE bank_card_id = NEW.id), 0);
  END IF;
  RETURN NEW;
END;
$$;

-- حذف trigger که daily_report_staff را مستقیم در موجودی تأثیر می‌داد
-- چون این trigger باعث دوبار شمارش می‌شود (یک‌بار از staff، یک‌بار از bank_card_transactions)
DROP TRIGGER IF EXISTS trg_recalc_bank_card_on_staff ON public.daily_report_staff;
DROP TRIGGER IF EXISTS trigger_recalculate_bank_card_balance_on_staff ON public.daily_report_staff;

-- بازمحاسبه موجودی تمام کارت‌ها
SELECT public.recalculate_all_bank_card_balances();
