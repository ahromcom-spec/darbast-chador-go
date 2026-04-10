#!/usr/bin/env node
/**
 * اسکریپت ایمپورت داده‌ها به Supabase Self-Hosted
 * 
 * نحوه استفاده:
 *   SUPABASE_URL=http://localhost:8000 SUPABASE_SERVICE_KEY=your-service-role-key node migration-data/import.js
 * 
 * یا با docker:
 *   docker exec -i supabase-db psql -U postgres < migration-data/import-psql.sql
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:8000';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_KEY is required');
  console.error('Usage: SUPABASE_URL=http://localhost:8000 SUPABASE_SERVICE_KEY=your-key node import.js');
  process.exit(1);
}

const dataDir = path.join(__dirname, 'data');

// ترتیب ایمپورت (بر اساس وابستگی‌ها)
const importOrder = [
  { file: '01-provinces.json', table: 'provinces' },
  { file: '02-districts.json', table: 'districts' },
  { file: '11-regions.json', table: 'regions' },
  { file: '03-service-categories.json', table: 'service_categories' },
  { file: '04-service-types.json', table: 'service_types_v3' },
  { file: '05-subcategories.json', table: 'subcategories' },
  { file: '12-service-activity-types.json', table: 'service_activity_types' },
  { file: '13-organizational-positions.json', table: 'organizational_positions' },
  { file: '14-activity-types.json', table: 'activity_types' },
  { file: '06-phone-whitelist.json', table: 'phone_whitelist' },
  { file: '15-profiles.json', table: 'profiles' },
  { file: '16-customers.json', table: 'customers' },
  { file: '07-user-roles.json', table: 'user_roles' },
  { file: '08-hr-employees.json', table: 'hr_employees' },
  { file: '09-module-assignments.json', table: 'module_assignments' },
  { file: '17-locations.json', table: 'locations' },
  { file: '18-projects-hierarchy.json', table: 'projects_hierarchy' },
  { file: '19-projects-v3.json', table: 'projects_v3' },
  { file: '20-bank-cards.json', table: 'bank_cards' },
  { file: '21-staff-salary-settings.json', table: 'staff_salary_settings' },
  { file: '10-order-payments.json', table: 'order_payments' },
  { file: '22-order-approvals.json', table: 'order_approvals' },
  { file: '23-order-messages.json', table: 'order_messages' },
  { file: '24-order-renewals.json', table: 'order_renewals' },
  { file: '25-order-transfer-requests.json', table: 'order_transfer_requests' },
  { file: '26-collection-requests.json', table: 'collection_requests' },
  { file: '27-daily-reports.json', table: 'daily_reports' },
  { file: '28-daily-report-orders.json', table: 'daily_report_orders' },
  { file: '29-daily-report-staff.json', table: 'daily_report_staff' },
  { file: '30-daily-report-date-locks.json', table: 'daily_report_date_locks' },
  { file: '31-bank-card-transactions.json', table: 'bank_card_transactions' },
  { file: '32-wallet-transactions.json', table: 'wallet_transactions' },
  { file: '33-project-media.json', table: 'project_media' },
  { file: '34-daily-report-order-media.json', table: 'daily_report_order_media' },
  { file: '35-expert-pricing-requests.json', table: 'expert_pricing_requests' },
];

async function supabaseRequest(tableName, data) {
  const url = `${SUPABASE_URL}/rest/v1/${tableName}`;
  const isHttps = url.startsWith('https');
  const mod = isHttps ? https : http;
  
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const urlObj = new URL(url);
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'apikey': SERVICE_KEY,
        'Prefer': 'resolution=merge-duplicates',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = mod.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => { responseBody += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ status: res.statusCode, body: responseBody });
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${responseBody}`));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function importTable(fileName, tableName) {
  const filePath = path.join(dataDir, fileName);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⏭️  ${fileName} not found, skipping...`);
    return;
  }

  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  
  if (!data || !Array.isArray(data) || data.length === 0) {
    console.log(`⏭️  ${fileName} is empty, skipping...`);
    return;
  }

  console.log(`📥 Importing ${data.length} rows into ${tableName}...`);

  // Import in batches of 100
  const batchSize = 100;
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    try {
      await supabaseRequest(tableName, batch);
      process.stdout.write(`   Batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(data.length/batchSize)} ✓\n`);
    } catch (err) {
      console.error(`   ❌ Error in batch ${Math.floor(i/batchSize) + 1}: ${err.message}`);
    }
  }

  console.log(`✅ ${tableName} done (${data.length} rows)`);
}

async function main() {
  console.log('🚀 Starting data import to Supabase...');
  console.log(`   URL: ${SUPABASE_URL}`);
  console.log('');

  for (const { file, table } of importOrder) {
    await importTable(file, table);
  }

  console.log('');
  console.log('🎉 Import complete!');
  console.log('');
  console.log('⚠️  Notes:');
  console.log('   - profiles table requires matching auth.users entries');
  console.log('   - Run auth user creation first using GoTrue API');
  console.log('   - Media files need to be uploaded to Storage separately');
}

main().catch(console.error);
