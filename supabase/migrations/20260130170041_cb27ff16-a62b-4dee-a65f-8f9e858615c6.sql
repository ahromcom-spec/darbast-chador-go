-- Enable realtime for bank_cards table to sync balance changes
ALTER PUBLICATION supabase_realtime ADD TABLE public.bank_cards;