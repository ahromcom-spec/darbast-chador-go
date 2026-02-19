
-- Create an atomic function to handle card-to-card transfers
-- This ensures both withdrawal and deposit are ALWAYS created together in one transaction
CREATE OR REPLACE FUNCTION public.transfer_between_bank_cards(
  p_from_card_id uuid,
  p_to_card_id uuid,
  p_amount numeric,
  p_description text DEFAULT NULL,
  p_created_at timestamptz DEFAULT now(),
  p_created_by uuid DEFAULT auth.uid()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from_card public.bank_cards%ROWTYPE;
  v_to_card public.bank_cards%ROWTYPE;
  v_from_new_balance numeric;
  v_to_new_balance numeric;
  v_withdrawal_id uuid;
  v_deposit_id uuid;
  v_from_desc text;
  v_to_desc text;
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

  IF NOT FOUND THEN
    RAISE EXCEPTION 'One or both cards not found';
  END IF;

  IF v_from_card.is_active = false OR v_to_card.is_active = false THEN
    RAISE EXCEPTION 'One or both cards are inactive';
  END IF;

  -- Calculate new balances
  v_from_new_balance := v_from_card.current_balance - p_amount;
  v_to_new_balance := v_to_card.current_balance + p_amount;

  -- Build descriptions
  v_from_desc := 'انتقال به ' || v_to_card.card_name || COALESCE(' - ' || p_description, '');
  v_to_desc := 'انتقال از ' || v_from_card.card_name || COALESCE(' - ' || p_description, '');

  -- Insert withdrawal from source card
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
    v_from_new_balance,
    v_from_desc,
    'card_transfer',
    p_to_card_id,
    p_created_by,
    p_created_at
  ) RETURNING id INTO v_withdrawal_id;

  -- Insert deposit to destination card
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
    v_to_new_balance,
    v_to_desc,
    'card_transfer',
    p_from_card_id,
    p_created_by,
    p_created_at
  ) RETURNING id INTO v_deposit_id;

  RETURN jsonb_build_object(
    'success', true,
    'withdrawal_id', v_withdrawal_id,
    'deposit_id', v_deposit_id,
    'from_card_name', v_from_card.card_name,
    'to_card_name', v_to_card.card_name
  );
END;
$$;
