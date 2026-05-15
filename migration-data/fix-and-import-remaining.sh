#!/usr/bin/env bash
# ==========================================================
# fix-and-import-remaining.sh
# Fixes schema gaps on VPS and re-imports the 3 failed/missing tables
# Usage on VPS:
#   cd /path/to/migration-data
#   bash fix-and-import-remaining.sh
# ==========================================================
set -e

DB_CONTAINER="${DB_CONTAINER:-$(docker ps --format '{{.Names}}' | grep -E 'supabase-db|supabase_db' | head -n1)}"
if [ -z "$DB_CONTAINER" ]; then
  echo "❌ Could not find supabase-db container"; exit 1
fi
echo "📦 Using DB container: $DB_CONTAINER"

PSQL="docker exec -i $DB_CONTAINER psql -U postgres -d postgres -v ON_ERROR_STOP=1"

# ----------------------------------------------------------
# 1) Schema fixes
# ----------------------------------------------------------
echo "🔧 Step 1/4: Schema fixes (enum + numeric + missing tables)"
# 1a) ALTER TYPE must run OUTSIDE a transaction block — run it standalone first
docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres \
  -c "ALTER TYPE project_status_v3 ADD VALUE IF NOT EXISTS 'paid';" || true

$PSQL <<'SQL'
\timing on
SET lock_timeout = '15s';
SET statement_timeout = '10min';

\echo '  1b/1f: daily_report_staff numeric columns...'
-- 1b) daily_report_staff numeric columns
ALTER TABLE public.daily_report_staff
  ALTER COLUMN overtime_hours TYPE NUMERIC USING overtime_hours::numeric,
  ALTER COLUMN amount_received TYPE NUMERIC USING amount_received::numeric,
  ALTER COLUMN amount_spent TYPE NUMERIC USING amount_spent::numeric;

\echo '  1c/1f: daily_report_staff extra columns...'
ALTER TABLE public.daily_report_staff
  ADD COLUMN IF NOT EXISTS bank_card_id UUID,
  ADD COLUMN IF NOT EXISTS is_company_expense BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS transaction_time TEXT;

\echo '  1d/1f: creating missing tables...'
-- 1c) Missing tables
CREATE TABLE IF NOT EXISTS public.staff_salary_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_code TEXT NOT NULL,
  staff_name TEXT NOT NULL,
  base_daily_salary NUMERIC NOT NULL DEFAULT 0,
  overtime_rate_fraction NUMERIC NOT NULL DEFAULT 0.167,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  previous_month_balance NUMERIC DEFAULT 0,
  previous_month_extra_received NUMERIC DEFAULT 0,
  bonuses NUMERIC DEFAULT 0,
  deductions NUMERIC DEFAULT 0,
  effective_from DATE,
  effective_to DATE
);

CREATE TABLE IF NOT EXISTS public.daily_report_date_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date DATE NOT NULL,
  locked_by UUID NOT NULL,
  locked_by_module_key TEXT NOT NULL,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.daily_report_order_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_report_order_id UUID,
  daily_report_id UUID NOT NULL,
  order_id UUID,
  user_id UUID NOT NULL,
  file_path TEXT NOT NULL,
  file_type VARCHAR NOT NULL,
  file_size INTEGER,
  mime_type VARCHAR,
  report_date DATE NOT NULL,
  synced_to_project_media BOOLEAN DEFAULT false,
  project_media_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  row_index INTEGER
);

CREATE TABLE IF NOT EXISTS public.module_shortcuts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  module_key TEXT NOT NULL,
  module_name TEXT NOT NULL,
  module_description TEXT,
  module_href TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  color TEXT
);

CREATE TABLE IF NOT EXISTS public.staff_verification_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  phone_number TEXT NOT NULL,
  requested_role app_role NOT NULL,
  position_id UUID,
  region_id UUID,
  status TEXT DEFAULT 'pending',
  verified_by UUID,
  verified_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.module_edit_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_key TEXT NOT NULL,
  module_date DATE NOT NULL DEFAULT CURRENT_DATE,
  locked_by UUID NOT NULL,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.repair_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  customer_id UUID NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  estimated_cost NUMERIC DEFAULT 1500000,
  final_cost NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  approved_by UUID,
  completed_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  payment_reference TEXT,
  request_date TIMESTAMPTZ,
  repaired_at TIMESTAMPTZ
);

\echo '  1e/1f: enabling RLS...'
ALTER TABLE public.staff_salary_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_report_date_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_report_order_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_shortcuts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_verification_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_edit_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_requests ENABLE ROW LEVEL SECURITY;
\echo '  1f/1f: schema fixes done.'
SQL

# ----------------------------------------------------------
# 2) Re-import the failed/missing JSON files
# ----------------------------------------------------------
echo ""
echo "📥 Step 2/4: Importing failed/missing tables..."

import_json() {
  local file="$1"
  local table="$2"
  if [ ! -f "data/$file" ]; then echo "  ⚠️  data/$file not found, skip"; return; fi
  local rows=$(python3 -c "import json; print(len(json.load(open('data/$file'))))")
  if [ "$rows" -eq 0 ]; then echo "  ⏭️  $table empty, skip"; return; fi

  echo "  → $table ($rows rows)"
  docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=0 <<SQL
SET session_replication_role = replica;
INSERT INTO public.$table
SELECT * FROM jsonb_populate_recordset(null::public.$table, \$\$$(cat data/$file)\$\$::jsonb)
ON CONFLICT DO NOTHING;
SET session_replication_role = origin;
SQL
}

# Re-do failures + new tables
import_json "19-projects-v3.json"              "projects_v3"
import_json "29-daily-report-staff.json"       "daily_report_staff"
import_json "21-staff-salary-settings.json"    "staff_salary_settings"
import_json "30-daily-report-date-locks.json"  "daily_report_date_locks"
import_json "34-daily-report-order-media.json" "daily_report_order_media"
import_json "43-module-shortcuts.json"         "module_shortcuts"
import_json "46-staff-verification-requests.json" "staff_verification_requests"
import_json "49-module-edit-locks.json"        "module_edit_locks"
import_json "50-repair-requests.json"          "repair_requests"

# ----------------------------------------------------------
# 3) Recompute bank-card balances (SSoT)
# ----------------------------------------------------------
echo ""
echo "🔄 Step 3/4: Recompute bank-card balances..."
docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -c "SELECT recalculate_all_bank_card_balances();" || echo "  (function not present, skipping)"

# ----------------------------------------------------------
# 4) Reload PostgREST schema cache
# ----------------------------------------------------------
echo ""
echo "🔃 Step 4/4: Reload PostgREST schema cache..."
docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -c "NOTIFY pgrst, 'reload schema';"

echo ""
echo "📊 Final row counts:"
docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -c "
SELECT 'projects_v3' AS t, count(*) FROM projects_v3
UNION ALL SELECT 'daily_report_staff', count(*) FROM daily_report_staff
UNION ALL SELECT 'staff_salary_settings', count(*) FROM staff_salary_settings
UNION ALL SELECT 'daily_report_date_locks', count(*) FROM daily_report_date_locks
UNION ALL SELECT 'daily_report_order_media', count(*) FROM daily_report_order_media
UNION ALL SELECT 'module_shortcuts', count(*) FROM module_shortcuts
UNION ALL SELECT 'staff_verification_requests', count(*) FROM staff_verification_requests
UNION ALL SELECT 'module_edit_locks', count(*) FROM module_edit_locks
UNION ALL SELECT 'repair_requests', count(*) FROM repair_requests;
"

echo ""
echo "✅ All done!"
