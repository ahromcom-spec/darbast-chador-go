-- Allow bank cards to be deleted even if referenced by historical records.
-- We keep history in those tables and simply detach the reference.

ALTER TABLE public.daily_report_staff
  DROP CONSTRAINT IF EXISTS daily_report_staff_bank_card_id_fkey;

ALTER TABLE public.daily_report_staff
  ADD CONSTRAINT daily_report_staff_bank_card_id_fkey
  FOREIGN KEY (bank_card_id)
  REFERENCES public.bank_cards(id)
  ON DELETE SET NULL;

ALTER TABLE public.order_payments
  DROP CONSTRAINT IF EXISTS order_payments_bank_card_id_fkey;

ALTER TABLE public.order_payments
  ADD CONSTRAINT order_payments_bank_card_id_fkey
  FOREIGN KEY (bank_card_id)
  REFERENCES public.bank_cards(id)
  ON DELETE SET NULL;
