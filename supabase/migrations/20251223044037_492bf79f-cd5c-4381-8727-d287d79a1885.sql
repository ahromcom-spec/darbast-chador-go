
-- Manually sync existing records that have staff_user_id (income transactions)
INSERT INTO wallet_transactions (user_id, transaction_type, amount, title, description, reference_type, reference_id)
SELECT 
  drs.staff_user_id,
  'income',
  drs.amount_received,
  'دریافتی از گزارش روزانه',
  COALESCE(drs.receiving_notes, 'تاریخ: ' || dr.report_date::text),
  'daily_report_staff',
  drs.id
FROM daily_report_staff drs
JOIN daily_reports dr ON dr.id = drs.daily_report_id
WHERE drs.staff_user_id IS NOT NULL
  AND drs.amount_received IS NOT NULL 
  AND drs.amount_received > 0
  AND NOT EXISTS (
    SELECT 1 FROM wallet_transactions wt 
    WHERE wt.reference_type = 'daily_report_staff' 
    AND wt.reference_id = drs.id
    AND wt.transaction_type = 'income'
  );

-- Sync expense transactions
INSERT INTO wallet_transactions (user_id, transaction_type, amount, title, description, reference_type, reference_id)
SELECT 
  drs.staff_user_id,
  'expense',
  -1 * drs.amount_spent,
  'پرداختی در گزارش روزانه',
  COALESCE(drs.spending_notes, 'تاریخ: ' || dr.report_date::text),
  'daily_report_staff',
  drs.id
FROM daily_report_staff drs
JOIN daily_reports dr ON dr.id = drs.daily_report_id
WHERE drs.staff_user_id IS NOT NULL
  AND drs.amount_spent IS NOT NULL 
  AND drs.amount_spent > 0
  AND NOT EXISTS (
    SELECT 1 FROM wallet_transactions wt 
    WHERE wt.reference_type = 'daily_report_staff' 
    AND wt.reference_id = drs.id
    AND wt.transaction_type = 'expense'
  );

-- Update the trigger function to use proper uuid type
CREATE OR REPLACE FUNCTION sync_daily_report_to_wallet()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id uuid;
  v_report_date date;
BEGIN
  -- Only proceed if staff_user_id is set
  IF NEW.staff_user_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  v_user_id := NEW.staff_user_id;
  
  -- Get the report date
  SELECT report_date INTO v_report_date
  FROM daily_reports
  WHERE id = NEW.daily_report_id;
  
  -- Delete existing transactions for this staff record to avoid duplicates
  DELETE FROM wallet_transactions
  WHERE reference_type = 'daily_report_staff'
    AND reference_id = NEW.id;
  
  -- Insert income transaction if amount_received > 0
  IF NEW.amount_received IS NOT NULL AND NEW.amount_received > 0 THEN
    INSERT INTO wallet_transactions (
      user_id,
      transaction_type,
      amount,
      title,
      description,
      reference_type,
      reference_id
    ) VALUES (
      v_user_id,
      'income',
      NEW.amount_received,
      'دریافتی از گزارش روزانه',
      COALESCE(NEW.receiving_notes, 'تاریخ: ' || v_report_date::text),
      'daily_report_staff',
      NEW.id
    );
  END IF;
  
  -- Insert expense transaction if amount_spent > 0
  IF NEW.amount_spent IS NOT NULL AND NEW.amount_spent > 0 THEN
    INSERT INTO wallet_transactions (
      user_id,
      transaction_type,
      amount,
      title,
      description,
      reference_type,
      reference_id
    ) VALUES (
      v_user_id,
      'expense',
      -1 * NEW.amount_spent,
      'پرداختی در گزارش روزانه',
      COALESCE(NEW.spending_notes, 'تاریخ: ' || v_report_date::text),
      'daily_report_staff',
      NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
