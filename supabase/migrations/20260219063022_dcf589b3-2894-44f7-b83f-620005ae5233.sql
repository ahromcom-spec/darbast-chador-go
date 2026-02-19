
-- Fix transfer_between_bank_cards to NOT rely on current_balance for balance_after
-- Instead, let the recalculate function handle it, and call it after insertion

CREATE OR REPLACE FUNCTION public.transfer_between_bank_cards(
  p_from_card_id uuid,
  p_to_card_id uuid,
  p_amount numeric,
  p_description text DEFAULT NULL,
  p_created_at timestamptz DEFAULT now(),
  p_created_by uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_from_card public.bank_cards%ROWTYPE;
  v_to_card public.bank_cards%ROWTYPE;
  v_withdrawal_id uuid;
  v_deposit_id uuid;
  v_from_desc text;
  v_to_desc text;
  v_from_new_balance numeric;
  v_to_new_balance numeric;
BEGIN
  -- Validate input
  IF p_from_card_id = p_to_card_id THEN
    RAISE EXCEPTION 'Source and destination cards cannot be the same';
  END IF;
  
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Transfer amount must be positive';
  END IF;

  -- Lock both cards to prevent concurrent updates (order by id to avoid deadlock)
  IF p_from_card_id < p_to_card_id THEN
    SELECT * INTO v_from_card FROM public.bank_cards WHERE id = p_from_card_id FOR UPDATE;
    SELECT * INTO v_to_card FROM public.bank_cards WHERE id = p_to_card_id FOR UPDATE;
  ELSE
    SELECT * INTO v_to_card FROM public.bank_cards WHERE id = p_to_card_id FOR UPDATE;
    SELECT * INTO v_from_card FROM public.bank_cards WHERE id = p_from_card_id FOR UPDATE;
  END IF;

  IF v_from_card.id IS NULL OR v_to_card.id IS NULL THEN
    RAISE EXCEPTION 'One or both cards not found';
  END IF;

  IF v_from_card.is_active = false OR v_to_card.is_active = false THEN
    RAISE EXCEPTION 'One or both cards are inactive';
  END IF;

  -- Build descriptions
  v_from_desc := 'انتقال به ' || v_to_card.card_name || COALESCE(' - ' || p_description, '');
  v_to_desc := 'انتقال از ' || v_from_card.card_name || COALESCE(' - ' || p_description, '');

  -- Insert withdrawal from source card (balance_after = 0 placeholder, will be recalculated)
  INSERT INTO public.bank_card_transactions (
    bank_card_id,
    transaction_type,
    amount,
    balance_after,
    description,
    reference_type,
    reference_id,
    created_by,
    created_at
  ) VALUES (
    p_from_card_id,
    'withdrawal',
    p_amount,
    0,
    v_from_desc,
    'card_transfer',
    p_to_card_id,
    p_created_by,
    p_created_at
  ) RETURNING id INTO v_withdrawal_id;

  -- Insert deposit to destination card (balance_after = 0 placeholder, will be recalculated)
  INSERT INTO public.bank_card_transactions (
    bank_card_id,
    transaction_type,
    amount,
    balance_after,
    description,
    reference_type,
    reference_id,
    created_by,
    created_at
  ) VALUES (
    p_to_card_id,
    'deposit',
    p_amount,
    0,
    v_to_desc,
    'card_transfer',
    p_from_card_id,
    p_created_by,
    p_created_at
  ) RETURNING id INTO v_deposit_id;

  -- Recalculate both card balances using the authoritative formula
  -- Source card
  SELECT v_from_card.initial_balance + COALESCE(
    SUM(CASE WHEN transaction_type = 'deposit' THEN amount ELSE -amount END), 0
  ) INTO v_from_new_balance
  FROM public.bank_card_transactions WHERE bank_card_id = p_from_card_id;
  
  UPDATE public.bank_cards 
  SET current_balance = v_from_new_balance, updated_at = now() 
  WHERE id = p_from_card_id;

  -- Destination card
  SELECT v_to_card.initial_balance + COALESCE(
    SUM(CASE WHEN transaction_type = 'deposit' THEN amount ELSE -amount END), 0
  ) INTO v_to_new_balance
  FROM public.bank_card_transactions WHERE bank_card_id = p_to_card_id;
  
  UPDATE public.bank_cards 
  SET current_balance = v_to_new_balance, updated_at = now() 
  WHERE id = p_to_card_id;

  RETURN jsonb_build_object(
    'success', true,
    'withdrawal_id', v_withdrawal_id,
    'deposit_id', v_deposit_id,
    'from_card_name', v_from_card.card_name,
    'to_card_name', v_to_card.card_name,
    'from_new_balance', v_from_new_balance,
    'to_new_balance', v_to_new_balance
  );
END;
$$;

-- Also fix the missing withdrawal transactions from Feb 18 (27M and 3M transfers)
-- The deposits exist but withdrawals from the management card are missing
-- Card IDs: management card = 5a8bb67f-3757-4ac6-b745-44451d55630a
-- Missing withdrawal for 27M deposit (id: f3f50e10, created_at: 2026-02-18 06:23:00)
-- Missing withdrawal for 3M deposit (id: 1c129a8b, created_at: 2026-02-18 06:22:00)

-- Insert the missing withdrawal transactions
INSERT INTO public.bank_card_transactions (
  bank_card_id, transaction_type, amount, balance_after,
  description, reference_type, reference_id, created_at
)
SELECT 
  '5a8bb67f-3757-4ac6-b745-44451d55630a',
  'withdrawal',
  t.amount,
  0,
  'انتقال به کارت سپه انصار/سپرده جاری',
  'card_transfer',
  '86970e5b-e8d7-4c6f-864e-6875680afafe',
  t.created_at
FROM public.bank_card_transactions t
WHERE t.id IN ('f3f50e10-9f45-4de6-9ef6-2076fcc0d11e', '1c129a8b-f280-4672-8c5a-21f1cacd8e5f')
  AND NOT EXISTS (
    SELECT 1 FROM public.bank_card_transactions w
    WHERE w.bank_card_id = '5a8bb67f-3757-4ac6-b745-44451d55630a'
      AND w.transaction_type = 'withdrawal'
      AND w.reference_type = 'card_transfer'
      AND w.reference_id = '86970e5b-e8d7-4c6f-864e-6875680afafe'
      AND w.amount = t.amount
      AND w.created_at = t.created_at
  );

-- Recalculate balances for both affected cards
SELECT public.recalculate_bank_card_balance('5a8bb67f-3757-4ac6-b745-44451d55630a');
SELECT public.recalculate_bank_card_balance('86970e5b-e8d7-4c6f-864e-6875680afafe');
