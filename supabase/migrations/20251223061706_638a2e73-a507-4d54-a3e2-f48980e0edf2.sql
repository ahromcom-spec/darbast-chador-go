-- Update sync_daily_report_to_wallet function to store report_date in description
CREATE OR REPLACE FUNCTION public.sync_daily_report_to_wallet()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_report_date date;
  v_daily_report_id uuid;
  v_report_date_str text;
BEGIN
  -- Only proceed if staff_user_id is set
  IF NEW.staff_user_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  v_user_id := NEW.staff_user_id;
  v_daily_report_id := NEW.daily_report_id;
  
  -- Get the report date
  SELECT report_date INTO v_report_date
  FROM daily_reports
  WHERE id = v_daily_report_id;
  
  -- Format the report date for display
  v_report_date_str := COALESCE(v_report_date::text, '');
  
  -- Delete existing transactions for this SPECIFIC staff record to avoid duplicates
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
      reference_id,
      created_at
    ) VALUES (
      v_user_id,
      'income',
      NEW.amount_received,
      'دریافتی از گزارش روزانه',
      CASE 
        WHEN NEW.receiving_notes IS NOT NULL AND NEW.receiving_notes != '' 
        THEN NEW.receiving_notes || ' | تاریخ گزارش: ' || v_report_date_str
        ELSE 'تاریخ گزارش: ' || v_report_date_str
      END,
      'daily_report_staff',
      NEW.id,
      -- Use report_date as created_at for proper date ordering
      COALESCE(v_report_date::timestamp with time zone, now())
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
      reference_id,
      created_at
    ) VALUES (
      v_user_id,
      'expense',
      -1 * NEW.amount_spent,
      'پرداختی در گزارش روزانه',
      CASE 
        WHEN NEW.spending_notes IS NOT NULL AND NEW.spending_notes != '' 
        THEN NEW.spending_notes || ' | تاریخ گزارش: ' || v_report_date_str
        ELSE 'تاریخ گزارش: ' || v_report_date_str
      END,
      'daily_report_staff',
      NEW.id,
      -- Use report_date as created_at for proper date ordering
      COALESCE(v_report_date::timestamp with time zone, now())
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Ensure trigger exists on daily_report_staff
DROP TRIGGER IF EXISTS sync_staff_wallet_trigger ON daily_report_staff;
CREATE TRIGGER sync_staff_wallet_trigger
  AFTER INSERT OR UPDATE ON daily_report_staff
  FOR EACH ROW
  EXECUTE FUNCTION sync_daily_report_to_wallet();