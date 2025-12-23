-- اصلاح تابع sync_daily_report_to_wallet برای جلوگیری از تکراری شدن
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
$function$;

-- حذف تراکنش‌های تکراری و نگه داشتن فقط آخرین تراکنش برای هر reference_id
DELETE FROM wallet_transactions a
USING wallet_transactions b
WHERE a.reference_type = 'daily_report_staff'
  AND b.reference_type = 'daily_report_staff'
  AND a.reference_id = b.reference_id
  AND a.transaction_type = b.transaction_type
  AND a.created_at < b.created_at;

-- همچنین تراکنش‌های مربوط به رکوردهایی که دیگر وجود ندارند را حذف کن
DELETE FROM wallet_transactions
WHERE reference_type = 'daily_report_staff'
  AND reference_id NOT IN (SELECT id FROM daily_report_staff);