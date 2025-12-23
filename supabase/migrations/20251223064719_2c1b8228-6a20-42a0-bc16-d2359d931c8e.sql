-- Fix duplicate wallet sync triggers + prevent orphan/duplicate wallet transactions

-- 1) Ensure only ONE wallet-sync trigger exists on daily_report_staff
DROP TRIGGER IF EXISTS sync_staff_wallet_trigger ON public.daily_report_staff;
DROP TRIGGER IF EXISTS sync_wallet_on_daily_report_staff ON public.daily_report_staff;

CREATE TRIGGER sync_wallet_on_daily_report_staff
AFTER INSERT OR UPDATE ON public.daily_report_staff
FOR EACH ROW
EXECUTE FUNCTION public.sync_daily_report_to_wallet();

-- 2) On delete of a staff row, remove its wallet transactions (prevents stale data when reports are edited/re-saved)
CREATE OR REPLACE FUNCTION public.delete_daily_report_staff_wallet_transactions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.wallet_transactions
  WHERE reference_type = 'daily_report_staff'
    AND reference_id = OLD.id;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS delete_wallet_on_daily_report_staff_delete ON public.daily_report_staff;
CREATE TRIGGER delete_wallet_on_daily_report_staff_delete
AFTER DELETE ON public.daily_report_staff
FOR EACH ROW
EXECUTE FUNCTION public.delete_daily_report_staff_wallet_transactions();

-- 3) Cleanup: remove orphan wallet transactions that reference deleted daily_report_staff rows
DELETE FROM public.wallet_transactions wt
WHERE wt.reference_type = 'daily_report_staff'
  AND NOT EXISTS (
    SELECT 1
    FROM public.daily_report_staff drs
    WHERE drs.id = wt.reference_id
  );

-- 4) Cleanup: remove duplicates (can happen when two triggers existed)
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY user_id, reference_type, reference_id, transaction_type
      ORDER BY created_at DESC, id DESC
    ) AS rn
  FROM public.wallet_transactions
)
DELETE FROM public.wallet_transactions wt
USING ranked r
WHERE wt.id = r.id
  AND r.rn > 1;

-- 5) Safety net: prevent future duplicates on the same reference
CREATE UNIQUE INDEX IF NOT EXISTS wallet_transactions_unique_reference
ON public.wallet_transactions (user_id, reference_type, reference_id, transaction_type);
