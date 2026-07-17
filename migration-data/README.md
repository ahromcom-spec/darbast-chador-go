# Database Migration — Lovable Cloud → Self-Hosted Supabase

Complete migration package for moving the Ahrom database from Lovable Cloud
to a self-hosted Supabase instance running on your own VPS.

## 1. Export

Two ways to produce the data:

### A. Live export from production (recommended)

1. Sign in as CEO / General Manager / Admin.
2. Visit `/admin-export`.
3. Click **دانلود فایل ZIP کامل دیتابیس**.
4. The download contains:
   ```
   public/<table>.json    ← one file per non-empty table
   auth/users.json        ← auth.users
   auth/identities.json   ← auth.identities (OAuth links)
   MANIFEST.json          ← row counts + export timestamp
   ```
   Empty tables are skipped — there are no dummy files.

Unzip into `migration-data/data/` (replacing the existing snapshot).

### B. Pre-bundled snapshot

The `data/` folder in this repo always ships with the latest dev snapshot
exported via the same edge function.

## 2. Schema

Run these SQL files **in order** against a fresh Postgres 15 (the Supabase
docker image already provides this):

```bash
psql "$DATABASE_URL" -f 01-enums.sql
psql "$DATABASE_URL" -f 00-full-schema.sql
psql "$DATABASE_URL" -f 10-functions.sql
psql "$DATABASE_URL" -f 11-triggers.sql
psql "$DATABASE_URL" -f 12-indexes.sql
psql "$DATABASE_URL" -f 13-rls-policies.sql
```

## 3. Auth users (must come before public data)

`auth.users` lives in the `auth` schema and is referenced as a foreign key
by ~30 public tables (profiles, customers, projects_v3, …). Restore it
**before** loading the public schema.

```bash
node restore-auth-users.js auth/users.json
```

(Helper script reads `auth/users.json` and calls
`POST /auth/v1/admin/users` with the service_role key on the target
instance.)

## 4. Public data — load order

Load order is dictated entirely by foreign key dependencies. Tables are
grouped into tiers; tier N only depends on tiers < N. Within a tier the
order is irrelevant.

Use `import-data.sh` (next section) which already enforces this order.

### Tier 0 — auth (handled in step 3)
- `auth.users`, `auth.identities`

### Tier 1 — root reference data (no FK dependencies inside `public`)
- `provinces`
- `service_categories`
- `service_types`
- `service_types_v3`
- `activity_types`
- `service_activity_types`
- `organizational_positions`
- `regions`
- `rating_criteria`
- `inventory_items`
- `bank_cards`
- `phone_whitelist`
- `staff_whitelist`
- `module_assignments`, `module_shortcuts`, `module_edit_locks`,
  `module_hierarchy_states`, `module_version_history`
- `najva_subscriptions`, `push_subscriptions`
- `otp_codes`, `email_verification_codes`
- `assistant_chat_messages`
- `audit_log`
- `notifications`
- `site_sessions`, `site_analytics`
- `hr_employees`, `staff_salary_settings`

### Tier 2 — depend on Tier 1
- `districts` → provinces
- `subcategories` → service_types_v3
- `bank_card_transactions` → bank_cards
- `contractors` → auth.users
- `staff_profiles`, `staff_verification_requests` → auth.users + organizational_positions
- `internal_staff_profiles` → auth.users + organizational_positions + regions
- `staff_roles` → auth.users + provinces + subcategories + service_types_v3
- `contractor_profiles` → regions, service_categories, service_activity_types
- `contractor_verification_requests` → regions, service_categories, activity_types
- `customers` → auth.users
- `profiles` → auth.users
- `wallet_transactions` → auth.users
- `profile_photos`
- `addresses` → auth.users
- `services` → contractors
- `inventory_reservations`, `service_line_items`, `service_media`,
  `workflow_tasks` → services
- `invoices` → services
- `payments` → invoices
- `user_roles` → auth.users

### Tier 3 — depend on Tier 2
- `contractor_services` → contractors
- `locations` → districts, provinces, auth.users
- `reputation_scores` → profiles
- `ratings` → profiles, projects_v3 (added later)
- `rating_helpful_votes`, `rating_responses` → ratings, profiles
- `expert_pricing_requests` → customers, districts, provinces, subcategories
- `expert_pricing_request_media` → expert_pricing_requests
- `projects_v2` → addresses, service_types, auth.users
- `service_requests_v2` → addresses, services, service_types, auth.users
- `service_requests` → auth.users, profiles
- `tickets` → auth.users, service_requests
- `ticket_messages`, `ticket_attachments` → tickets
- `scaffolding_requests`

### Tier 4 — depend on Tier 3
- `projects_hierarchy` → auth.users, locations, service_types_v3, subcategories
- `project_collaborators`, `project_hierarchy_media` → projects_hierarchy
- `projects` → (legacy)
- `orders` → projects_hierarchy, auth.users
- `assignments` → projects, auth.users
- `project_progress_stages`, `project_progress_media` → projects, projects_v3
- `project_assignments` → contractors, service_requests

### Tier 5 — projects_v3 and its descendants
- `projects_v3` → customers, districts, provinces, subcategories,
  contractors, projects_hierarchy, auth.users
- `services_v3` → projects_v3
- `project_media` → projects_v3
- `approved_media` → projects_v3
- `call_logs` → projects_v3
- `voice_call_signals` → projects_v3
- `order_collaborators` → projects_v3
- `order_messages` → projects_v3
- `order_payments` → projects_v3, bank_cards
- `order_daily_logs` → projects_v3
- `order_renewals` → projects_v3, customers
- `order_transfer_requests` → projects_v3
- `order_approvals` → projects_v3, subcategories, auth.users
- `collection_requests` → projects_v3, customers
- `collection_request_messages` → collection_requests
- `repair_requests` → projects_v3, customers
- `repair_request_messages`, `repair_request_media` → repair_requests
- `daily_reports` → auth.users
- `daily_report_orders` → daily_reports, projects_v3
- `daily_report_staff` → daily_reports, bank_cards, auth.users
- `daily_report_order_media` → daily_reports, daily_report_orders,
  project_media, projects_v3
- `daily_report_date_locks`

## 5. Import

```bash
chmod +x import-data.sh
./import-data.sh "postgresql://postgres:PASSWORD@HOST:5432/postgres" ./data
```

The script:
- Iterates tiers in dependency order.
- For each table found in `data/`, calls
  `INSERT … SELECT * FROM jsonb_populate_recordset(null::public.<table>, …)
  ON CONFLICT DO NOTHING`.
- Skips tables that have no JSON file (i.e. were empty in production).
- Disables triggers during load to avoid side-effects (notifications,
  wallet sync, etc.). Triggers are re-enabled at the end.

## 6. Storage buckets

The project uses the following buckets:

| Bucket               | Public | Purpose                          |
|----------------------|--------|----------------------------------|
| `avatars`            | yes    | User avatars                     |
| `profile-images`     | yes    | Profile gallery                  |
| `project-media`      | yes    | Order/project photos and videos  |
| `executive-progress` | yes    | Executive progress media         |
| `order-media`        | yes    | Order chat attachments           |
| `voice-messages`     | yes    | Voice call recordings            |
| `ticket-attachments` | no     | Ticket attachments               |

Use `download-storage.sh` to mirror every bucket locally:

```bash
export SOURCE_URL=https://gclbltatkbwbqxqqrcea.supabase.co
export SOURCE_SERVICE_KEY=<service_role_key>
chmod +x download-storage.sh
./download-storage.sh ./storage-dump
```

Then upload the contents of `storage-dump/<bucket>/…` to the same buckets
on the target instance (the helper `upload-storage.sh` is also provided).

## 7. Post-import sanity checks

```sql
SELECT 'projects_v3' AS table, COUNT(*) FROM projects_v3
UNION ALL SELECT 'profiles', COUNT(*) FROM profiles
UNION ALL SELECT 'customers', COUNT(*) FROM customers
UNION ALL SELECT 'site_analytics', COUNT(*) FROM site_analytics;

SELECT public.recalculate_all_bank_card_balances();
```

Compare the row counts against `MANIFEST.json` from your export ZIP.
