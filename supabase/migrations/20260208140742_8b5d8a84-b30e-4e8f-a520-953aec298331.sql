-- 1) Normalize legacy rows: if name indicates company expense, enforce flag
UPDATE public.daily_report_staff
SET is_company_expense = true
WHERE (is_company_expense IS DISTINCT FROM true)
  AND staff_name ILIKE '%ماهیت شرکت اهرم%';

-- 2) Remove duplicates: keep the most recently updated row per report
WITH ranked AS (
  SELECT
    id,
    daily_report_id,
    row_number() OVER (
      PARTITION BY daily_report_id
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM public.daily_report_staff
  WHERE is_company_expense IS TRUE
)
DELETE FROM public.daily_report_staff s
USING ranked r
WHERE s.id = r.id
  AND r.rn > 1;

-- 3) Prevent future duplicates (partial unique index)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'daily_report_staff_one_company_expense_per_report'
  ) THEN
    CREATE UNIQUE INDEX daily_report_staff_one_company_expense_per_report
      ON public.daily_report_staff (daily_report_id)
      WHERE is_company_expense IS TRUE;
  END IF;
END $$;