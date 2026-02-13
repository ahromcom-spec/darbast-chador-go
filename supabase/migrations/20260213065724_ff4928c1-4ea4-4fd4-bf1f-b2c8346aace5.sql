
-- Add module_name and report_date columns to bank_card_transactions
ALTER TABLE public.bank_card_transactions 
  ADD COLUMN module_name TEXT,
  ADD COLUMN report_date DATE;
