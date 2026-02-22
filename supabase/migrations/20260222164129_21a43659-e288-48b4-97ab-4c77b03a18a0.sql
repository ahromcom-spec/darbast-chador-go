-- Delete the orphaned transaction (reference_id points to non-existent daily_report_staff row)
DELETE FROM public.bank_card_transactions 
WHERE id = '167de0db-cf27-4572-8577-9a05fdee5fbd';

-- Recalculate the bank card balance from transactions (SSoT)
UPDATE public.bank_cards 
SET current_balance = initial_balance + COALESCE(
  (SELECT SUM(CASE WHEN transaction_type = 'deposit' THEN amount ELSE -amount END) 
   FROM public.bank_card_transactions 
   WHERE bank_card_id = bank_cards.id), 0),
  updated_at = now()
WHERE card_name = 'کارت اجرایی، قرض الحسنه';