#!/usr/bin/env node
/**
 * Restore auth.users on the target self-hosted Supabase instance.
 *
 * Usage:
 *   TARGET_URL=https://supabase.your-vps.com \
 *   TARGET_SERVICE_KEY=<service_role_key> \
 *   node restore-auth-users.js auth/users.json
 *
 * Notes:
 *   - GoTrue's admin API does not let us re-set encrypted_password directly,
 *     but the export ZIP captures the original hash inside `users.json`.
 *     We send the user as-is and GoTrue will preserve the id (since we
 *     create with `id` in body via the admin API).
 *   - If a user already exists (matched by id or email), we skip.
 */

const fs = require('fs');

const URL = process.env.TARGET_URL;
const KEY = process.env.TARGET_SERVICE_KEY;
const FILE = process.argv[2] || 'auth/users.json';

if (!URL || !KEY) {
  console.error('TARGET_URL and TARGET_SERVICE_KEY env vars required');
  process.exit(1);
}

(async () => {
  const users = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  console.log(`→ Restoring ${users.length} auth users to ${URL}`);

  let ok = 0, skipped = 0, failed = 0;
  for (const u of users) {
    const body = {
      id: u.id,
      email: u.email || undefined,
      phone: u.phone || undefined,
      email_confirm: !!u.email_confirmed_at,
      phone_confirm: !!u.phone_confirmed_at,
      user_metadata: u.user_metadata || {},
      app_metadata: u.app_metadata || {},
    };

    const res = await fetch(`${URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KEY}`,
        apikey: KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      ok++;
    } else if (res.status === 422 || res.status === 409) {
      skipped++; // already exists
    } else {
      failed++;
      const txt = await res.text();
      console.warn(`  ✗ ${u.id} ${u.email || u.phone}: ${res.status} ${txt}`);
    }
  }
  console.log(`✅ created=${ok} skipped=${skipped} failed=${failed}`);
  console.log('\nNOTE: Passwords cannot be restored via the admin API.');
  console.log('Users will need to use "Forgot password" or OTP login on first sign-in.');
})();
