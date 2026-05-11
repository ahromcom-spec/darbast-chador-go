#!/usr/bin/env node
/**
 * ساخت auth.users از روی profiles.json - بدون نیاز به @supabase/supabase-js
 * فقط از http/https داخلی node استفاده می‌کنه
 *
 * استفاده:
 *   SUPABASE_URL=http://localhost:8000 \
 *   SUPABASE_SERVICE_KEY=<service_role_key> \
 *   node create-auth-users.js
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:8000';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const DEFAULT_PASSWORD = process.env.DEFAULT_PASSWORD || 'Ahrom@2025!';

if (!SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_KEY is required');
  process.exit(1);
}

const profilesPath = path.join(__dirname, 'data', '15-profiles.json');
if (!fs.existsSync(profilesPath)) {
  console.error('❌ profiles file not found:', profilesPath);
  process.exit(1);
}

const profiles = JSON.parse(fs.readFileSync(profilesPath, 'utf8'));
console.log(`📋 ${profiles.length} profiles loaded`);

function request(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(SUPABASE_URL + urlPath);
    const mod = url.protocol === 'https:' ? https : http;
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'apikey': SERVICE_KEY,
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };
    const req = mod.request(opts, (res) => {
      let buf = '';
      res.on('data', (c) => (buf += c));
      res.on('end', () => {
        let parsed = null;
        try { parsed = buf ? JSON.parse(buf) : null; } catch { parsed = buf; }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function createUser(profile) {
  // GoTrue admin endpoint: POST /auth/v1/admin/users
  const payload = {
    id: profile.id, // مهم: همان UUID که در profiles هست
    email: profile.email || `${profile.id}@placeholder.local`,
    phone: profile.phone || undefined,
    password: DEFAULT_PASSWORD,
    email_confirm: true,
    phone_confirm: !!profile.phone,
    user_metadata: {
      full_name: profile.full_name || null,
      imported: true,
    },
  };
  // پاکسازی undefined
  Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

  const res = await request('POST', '/auth/v1/admin/users', payload);
  return res;
}

(async () => {
  console.log('🚀 Creating auth users via GoTrue admin API...');
  console.log(`   URL: ${SUPABASE_URL}`);
  console.log(`   Default password: ${DEFAULT_PASSWORD}`);
  console.log('');

  let ok = 0, skip = 0, fail = 0;
  const errors = [];

  for (let i = 0; i < profiles.length; i++) {
    const p = profiles[i];
    try {
      const res = await createUser(p);
      if (res.status >= 200 && res.status < 300) {
        ok++;
        if ((i + 1) % 10 === 0) console.log(`   ${i + 1}/${profiles.length} ✓`);
      } else {
        const msg = JSON.stringify(res.body);
        if (
          res.status === 422 ||
          msg.includes('already') ||
          msg.includes('exists') ||
          msg.includes('duplicate')
        ) {
          skip++;
        } else {
          fail++;
          errors.push({ id: p.id, status: res.status, body: res.body });
          if (fail <= 5) console.error(`   ❌ ${p.id}: HTTP ${res.status} ${msg.slice(0, 200)}`);
        }
      }
    } catch (e) {
      fail++;
      errors.push({ id: p.id, error: e.message });
      if (fail <= 5) console.error(`   ❌ ${p.id}: ${e.message}`);
    }
  }

  console.log('');
  console.log('🎉 Done!');
  console.log(`   ✅ Created: ${ok}`);
  console.log(`   ⏭️  Skipped (already exists): ${skip}`);
  console.log(`   ❌ Failed: ${fail}`);
  if (fail > 0) {
    fs.writeFileSync(
      path.join(__dirname, 'auth-users-errors.json'),
      JSON.stringify(errors, null, 2)
    );
    console.log(`   📄 Errors saved to auth-users-errors.json`);
  }
})();
