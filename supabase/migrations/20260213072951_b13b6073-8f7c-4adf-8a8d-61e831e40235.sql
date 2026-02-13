
-- Drop the problematic trigger that conflicts with auto-save
DROP TRIGGER IF EXISTS trg_cleanup_bank_txns_on_staff_delete ON public.daily_report_staff;
DROP FUNCTION IF EXISTS public.cleanup_bank_card_transactions_on_staff_delete();
