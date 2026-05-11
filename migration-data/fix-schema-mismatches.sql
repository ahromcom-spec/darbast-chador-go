-- ============================================
-- Fix VPS schema mismatches before re-importing
-- Run on VPS: docker exec -i $(docker ps -qf "name=supabase-db") \
--   psql -U postgres -d postgres < migration-data/fix-schema-mismatches.sql
-- ============================================

\echo '🔧 Adding missing columns...'

-- 1. profiles.password_set_at
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS password_set_at TIMESTAMPTZ;

-- 2. module_assignments.module_description
ALTER TABLE public.module_assignments
  ADD COLUMN IF NOT EXISTS module_description TEXT;

-- 3. daily_report_staff.bank_card_id
ALTER TABLE public.daily_report_staff
  ADD COLUMN IF NOT EXISTS bank_card_id UUID;

\echo '🔧 Relaxing constraints...'

-- 4. hr_employees.phone_number nullable
ALTER TABLE public.hr_employees
  ALTER COLUMN phone_number DROP NOT NULL;

-- 5. order_approvals varchar(50) → text  (find which column it is)
DO $$
DECLARE
  col RECORD;
BEGIN
  FOR col IN
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema='public'
      AND table_name='order_approvals'
      AND data_type='character varying'
      AND character_maximum_length=50
  LOOP
    EXECUTE format('ALTER TABLE public.order_approvals ALTER COLUMN %I TYPE TEXT', col.column_name);
    RAISE NOTICE 'Converted order_approvals.% to TEXT', col.column_name;
  END LOOP;
END $$;

-- 6. daily_report_orders.order_id nullable (some rows have null order_id)
ALTER TABLE public.daily_report_orders
  ALTER COLUMN order_id DROP NOT NULL;

\echo '🔧 Checking daily_report_order_media table...'

-- 7. Check if table exists with different name
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='daily_report_order_media'
  ) THEN
    RAISE NOTICE '⚠️  Table daily_report_order_media does not exist. You need to create it manually or skip its import.';
  END IF;
END $$;

\echo '🔄 Reloading PostgREST schema cache...'
NOTIFY pgrst, 'reload schema';

\echo '✅ Done! Now re-run: node import.js'
