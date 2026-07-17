-- Remove duplicate bank_card_transactions for same (reference_type, reference_id, bank_card_id, transaction_type, amount, description)
-- Keep the earliest one
WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY reference_type, reference_id, bank_card_id, transaction_type, amount, COALESCE(description,'')
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.bank_card_transactions
  WHERE reference_type = 'daily_report_staff'
)
DELETE FROM public.bank_card_transactions
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Recalculate balances for all bank cards to reflect the cleanup
DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT id FROM public.bank_cards LOOP
    PERFORM public.recalculate_bank_card_balance(c.id);
  END LOOP;
END $$;