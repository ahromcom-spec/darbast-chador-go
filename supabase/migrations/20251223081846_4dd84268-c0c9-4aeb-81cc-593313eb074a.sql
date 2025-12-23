-- Add is_archived column to daily_reports table
ALTER TABLE public.daily_reports 
ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS archived_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES auth.users(id);

-- Create index for quick filtering
CREATE INDEX IF NOT EXISTS idx_daily_reports_archived ON public.daily_reports(is_archived);

-- Update the wallet sync trigger to skip archived reports
CREATE OR REPLACE FUNCTION public.sync_daily_report_to_wallet()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id uuid;
  v_report_date date;
  v_daily_report_id uuid;
  v_report_date_str text;
  v_is_archived boolean;
BEGIN
  -- Only proceed if staff_user_id is set
  IF NEW.staff_user_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  v_user_id := NEW.staff_user_id;
  v_daily_report_id := NEW.daily_report_id;
  
  -- Get the report date and archived status
  SELECT report_date, COALESCE(is_archived, false) INTO v_report_date, v_is_archived
  FROM daily_reports
  WHERE id = v_daily_report_id;
  
  -- If report is archived, don't create wallet transactions
  IF v_is_archived = true THEN
    -- Delete any existing transactions for this staff record
    DELETE FROM wallet_transactions
    WHERE reference_type = 'daily_report_staff'
      AND reference_id = NEW.id;
    RETURN NEW;
  END IF;
  
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
      COALESCE(v_report_date::timestamp with time zone, now())
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create function to archive a report and remove wallet transactions
CREATE OR REPLACE FUNCTION public.archive_daily_report(p_report_id uuid)
RETURNS void AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Update the report to archived
  UPDATE public.daily_reports
  SET 
    is_archived = true,
    archived_at = now(),
    archived_by = v_user_id
  WHERE id = p_report_id;
  
  -- Delete wallet transactions for all staff in this report
  DELETE FROM public.wallet_transactions wt
  WHERE wt.reference_type = 'daily_report_staff'
    AND wt.reference_id IN (
      SELECT drs.id 
      FROM public.daily_report_staff drs 
      WHERE drs.daily_report_id = p_report_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create function to unarchive a report and restore wallet transactions
CREATE OR REPLACE FUNCTION public.unarchive_daily_report(p_report_id uuid)
RETURNS void AS $$
DECLARE
  v_user_id uuid;
  staff_row RECORD;
  v_report_date date;
  v_report_date_str text;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Get report date
  SELECT report_date INTO v_report_date
  FROM public.daily_reports
  WHERE id = p_report_id;
  
  v_report_date_str := COALESCE(v_report_date::text, '');
  
  -- Update the report to not archived
  UPDATE public.daily_reports
  SET 
    is_archived = false,
    archived_at = NULL,
    archived_by = NULL
  WHERE id = p_report_id;
  
  -- Re-create wallet transactions for all staff in this report
  FOR staff_row IN 
    SELECT * FROM public.daily_report_staff 
    WHERE daily_report_id = p_report_id 
      AND staff_user_id IS NOT NULL
  LOOP
    -- Insert income transaction if amount_received > 0
    IF staff_row.amount_received IS NOT NULL AND staff_row.amount_received > 0 THEN
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
        staff_row.staff_user_id,
        'income',
        staff_row.amount_received,
        'دریافتی از گزارش روزانه',
        CASE 
          WHEN staff_row.receiving_notes IS NOT NULL AND staff_row.receiving_notes != '' 
          THEN staff_row.receiving_notes || ' | تاریخ گزارش: ' || v_report_date_str
          ELSE 'تاریخ گزارش: ' || v_report_date_str
        END,
        'daily_report_staff',
        staff_row.id,
        COALESCE(v_report_date::timestamp with time zone, now())
      );
    END IF;
    
    -- Insert expense transaction if amount_spent > 0
    IF staff_row.amount_spent IS NOT NULL AND staff_row.amount_spent > 0 THEN
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
        staff_row.staff_user_id,
        'expense',
        -1 * staff_row.amount_spent,
        'پرداختی در گزارش روزانه',
        CASE 
          WHEN staff_row.spending_notes IS NOT NULL AND staff_row.spending_notes != '' 
          THEN staff_row.spending_notes || ' | تاریخ گزارش: ' || v_report_date_str
          ELSE 'تاریخ گزارش: ' || v_report_date_str
        END,
        'daily_report_staff',
        staff_row.id,
        COALESCE(v_report_date::timestamp with time zone, now())
      );
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;