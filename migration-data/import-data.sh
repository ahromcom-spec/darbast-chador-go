#!/usr/bin/env bash
# import-data.sh — load the JSON snapshot into a fresh Supabase Postgres.
#
# Usage:
#   ./import-data.sh "postgresql://postgres:PASS@HOST:5432/postgres" ./data
#
# Requirements:
#   - psql in PATH
#   - Schema already created (run 01-enums → 13-rls-policies first)
#   - auth.users already restored (see restore-auth-users.js)
#
# What it does:
#   1. Disables user triggers globally (avoids notification + wallet noise).
#   2. Loads JSON files in dependency-tier order using jsonb_populate_recordset.
#   3. Re-enables triggers and recalculates derived data.

set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "usage: $0 <postgres-url> <data-dir>" >&2
  exit 1
fi

DB_URL="$1"
DATA_DIR="$2"

if [[ ! -d "$DATA_DIR" ]]; then
  echo "data dir not found: $DATA_DIR" >&2
  exit 1
fi

# Tier-ordered table list. Tables not present as JSON files are silently
# skipped (they were empty in production).
TABLES=(
  # Tier 1 — root reference
  provinces service_categories service_types service_types_v3
  activity_types service_activity_types organizational_positions regions
  rating_criteria inventory_items bank_cards phone_whitelist staff_whitelist
  module_assignments module_shortcuts module_edit_locks
  module_hierarchy_states module_version_history
  najva_subscriptions push_subscriptions
  otp_codes email_verification_codes
  assistant_chat_messages audit_log notifications
  site_sessions site_analytics
  hr_employees staff_salary_settings

  # Tier 2
  districts subcategories bank_card_transactions
  contractors staff_profiles staff_verification_requests
  internal_staff_profiles staff_roles
  contractor_profiles contractor_verification_requests
  customers profiles wallet_transactions profile_photos addresses
  services inventory_reservations service_line_items service_media
  workflow_tasks invoices payments user_roles

  # Tier 3
  contractor_services locations reputation_scores
  expert_pricing_requests expert_pricing_request_media
  projects_v2 service_requests_v2 service_requests
  tickets ticket_messages ticket_attachments scaffolding_requests

  # Tier 4
  projects_hierarchy project_collaborators project_hierarchy_media
  projects orders assignments
  project_progress_stages project_progress_media project_assignments

  # Tier 5
  projects_v3 services_v3 project_media approved_media
  call_logs voice_call_signals
  order_collaborators order_messages order_payments order_daily_logs
  order_renewals order_transfer_requests order_approvals
  ratings rating_helpful_votes rating_responses
  collection_requests collection_request_messages
  repair_requests repair_request_messages repair_request_media
  daily_reports daily_report_orders daily_report_staff
  daily_report_order_media daily_report_date_locks
)

run_psql() {
  PGOPTIONS='--client-min-messages=warning' psql "$DB_URL" -v ON_ERROR_STOP=1 "$@"
}

echo "→ Disabling user triggers globally"
run_psql -c "SET session_replication_role = 'replica';" >/dev/null

# Per-table import is a single transaction so triggers stay disabled.
import_table() {
  local table="$1"
  local file="$DATA_DIR/${table}.json"
  if [[ ! -f "$file" ]]; then
    printf "  ⏭  %-40s (no file — skipped)\n" "$table"
    return
  fi
  local count
  count=$(jq 'length' "$file" 2>/dev/null || echo 0)
  if [[ "$count" == "0" ]]; then
    printf "  ⏭  %-40s (empty)\n" "$table"
    return
  fi

  # Stream JSON via stdin to avoid bash arg-length limits on large files.
  local sql
  sql=$(cat <<SQL
BEGIN;
SET LOCAL session_replication_role = 'replica';
WITH input AS (
  SELECT \$1::jsonb AS j
)
INSERT INTO public.${table}
SELECT * FROM jsonb_populate_recordset(null::public.${table}, (SELECT j FROM input))
ON CONFLICT DO NOTHING;
COMMIT;
SQL
)
  # Use -v variable binding via psql's :'json' substitution.
  if jq -c '.' "$file" | run_psql \
      -v "json=$(cat "$file")" \
      -c "BEGIN; SET LOCAL session_replication_role = 'replica';
          INSERT INTO public.${table}
          SELECT * FROM jsonb_populate_recordset(null::public.${table}, :'json'::jsonb)
          ON CONFLICT DO NOTHING;
          COMMIT;" >/dev/null 2>&1; then
    printf "  ✅ %-40s (%s rows)\n" "$table" "$count"
  else
    printf "  ❌ %-40s FAILED\n" "$table" >&2
    return 1
  fi
}

echo "→ Loading tables (dependency order)"
for t in "${TABLES[@]}"; do
  import_table "$t"
done

echo "→ Re-enabling triggers + post-import maintenance"
run_psql <<'SQL'
SET session_replication_role = 'origin';

-- Recompute derived balances now that triggers are back on
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'recalculate_all_bank_card_balances') THEN
    PERFORM public.recalculate_all_bank_card_balances();
  END IF;
END $$;

-- Bump sequences past the highest imported id (covers any non-uuid serial PKs)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT seq.relname AS seq_name,
           tab.relname AS tab_name,
           a.attname  AS col_name
    FROM pg_class seq
    JOIN pg_depend d  ON d.objid = seq.oid AND d.deptype = 'a'
    JOIN pg_class tab ON tab.oid = d.refobjid
    JOIN pg_attribute a ON a.attrelid = tab.oid AND a.attnum = d.refobjsubid
    JOIN pg_namespace n ON n.oid = seq.relnamespace
    WHERE seq.relkind = 'S' AND n.nspname = 'public'
  LOOP
    EXECUTE format(
      'SELECT setval(%L, GREATEST(COALESCE((SELECT MAX(%I) FROM public.%I), 0), 1))',
      'public.' || r.seq_name, r.col_name, r.tab_name
    );
  END LOOP;
END $$;
SQL

echo "✅ Import complete"
