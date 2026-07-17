#!/usr/bin/env node
/**
 * Import JSON data into self-hosted Supabase via REST API
 * Usage: SUPABASE_URL=http://localhost:8000 SUPABASE_SERVICE_KEY=xxx node import.js
 */

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY env vars');
  process.exit(1);
}

const IMPORT_ORDER = [
  'provinces', 'districts', 'regions',
  'service_categories', 'service_types', 'service_types_v3', 'subcategories',
  'service_activity_types', 'organizational_positions', 'activity_types',
  'profiles', 'phone_whitelist', 'user_roles',
  'customers', 'locations', 'addresses',
  'contractors', 'contractor_profiles', 'contractor_services', 'contractor_verification_requests',
  'internal_staff_profiles', 'staff_profiles', 'staff_verification_requests',
  'hr_employees', 'staff_salary_settings',
  'projects_hierarchy', 'projects_v3',
  'bank_cards',
  'order_approvals', 'order_messages', 'order_payments', 'order_daily_logs',
  'order_collaborators', 'order_transfer_requests', 'order_renewals',
  'collection_requests', 'collection_request_messages',
  'daily_reports', 'daily_report_orders', 'daily_report_staff',
  'daily_report_date_locks', 'daily_report_order_media',
  'bank_card_transactions', 'wallet_transactions',
  'project_media', 'project_hierarchy_media', 'approved_media',
  'expert_pricing_requests', 'expert_pricing_request_media',
  'repair_requests', 'repair_request_messages', 'repair_request_media',
  'notifications', 'audit_log',
  'module_assignments', 'module_shortcuts', 'module_edit_locks',
  'module_hierarchy_states', 'module_version_history',
  'profile_photos', 'assistant_chat_messages',
  'otp_codes', 'email_verification_codes', 'push_subscriptions',
  'rating_criteria', 'scaffolding_requests', 'service_requests',
  'tickets', 'site_sessions', 'site_analytics',
];

const BATCH_SIZE = 500;

async function importTable(tableName) {
  const filePath = path.join(__dirname, 'data', `${tableName}.json`);
  if (!fs.existsSync(filePath)) {
    console.log(`⏭️  ${tableName}: no data file`);
    return;
  }

  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!data.length) {
    console.log(`⏭️  ${tableName}: empty`);
    return;
  }

  let inserted = 0;
  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batch = data.slice(i, i + BATCH_SIZE);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${tableName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'apikey': SUPABASE_KEY,
        'Prefer': 'resolution=ignore-duplicates',
      },
      body: JSON.stringify(batch),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`❌ ${tableName} batch ${i}: ${err}`);
    } else {
      inserted += batch.length;
    }
  }
  console.log(`✅ ${tableName}: ${inserted} rows`);
}

async function main() {
  console.log(`Importing into ${SUPABASE_URL}...\n`);
  for (const table of IMPORT_ORDER) {
    await importTable(table);
  }
  console.log('\n🎉 Import complete!');
}

main().catch(console.error);
