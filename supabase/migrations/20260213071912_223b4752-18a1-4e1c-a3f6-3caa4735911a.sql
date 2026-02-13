
-- When daily_report_staff rows are deleted, automatically remove related bank_card_transactions
-- and recalculate the bank card balance
CREATE OR REPLACE FUNCTION public.cleanup_bank_card_transactions_on_staff_delete()
RETURNS TRIGGER AS $$
DECLARE
  v_card_id UUID;
  v_report_id UUID;
BEGIN
  -- Only act if the deleted staff row had a bank_card_id
  IF OLD.bank_card_id IS NOT NULL THEN
    v_card_id := OLD.bank_card_id;
    v_report_id := OLD.daily_report_id;
    
    -- Delete related bank card transactions
    DELETE FROM bank_card_transactions
    WHERE reference_type = 'daily_report_staff'
      AND reference_id = v_report_id
      AND bank_card_id = v_card_id;
    
    -- Recalculate balance
    PERFORM recalculate_bank_card_balance(v_card_id);
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_cleanup_bank_txns_on_staff_delete
  AFTER DELETE ON public.daily_report_staff
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_bank_card_transactions_on_staff_delete();
