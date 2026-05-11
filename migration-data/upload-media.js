#!/usr/bin/env node
// ============================================================
// upload-media.js — Upload local media files to VPS Supabase
// Run on VPS: node upload-media.js
// Reads: ./media-files/<bucket>/<path>
// ============================================================

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:8000';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const MEDIA_DIR = process.env.MEDIA_DIR || './media-files';

if (!SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_KEY required');
  console.error('Usage: SUPABASE_SERVICE_KEY=xxx node upload-media.js');
  process.exit(1);
}

if (!fs.existsSync(MEDIA_DIR)) {
  console.error(`❌ Media dir not found: ${MEDIA_DIR}`);
  process.exit(1);
}

// Required buckets (must exist on VPS already)
const BUCKETS = {
  'order-media': true,
  'project-media': true,
  'profile-images': true,
  'executive-progress': true,
  'avatars': true,
  'voice-messages': false,
  'ticket-attachments': false,
};

const MIMES = {
  '.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.gif':'image/gif',
  '.webp':'image/webp','.mp4':'video/mp4','.webm':'video/webm','.mov':'video/quicktime',
  '.mp3':'audio/mpeg','.m4a':'audio/m4a','.wav':'audio/wav','.ogg':'audio/ogg',
  '.pdf':'application/pdf',
};

function uploadFile(bucket, objPath, fileBuf, mime) {
  const url = `${SUPABASE_URL}/storage/v1/object/${bucket}/${objPath}`;
  const isHttps = url.startsWith('https');
  const mod = isHttps ? https : http;
  const u = new URL(url);
  return new Promise((resolve, reject) => {
    const req = mod.request({
      hostname: u.hostname, port: u.port, path: u.pathname + u.search,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'apikey': SERVICE_KEY,
        'Content-Type': mime,
        'Content-Length': fileBuf.length,
        'x-upsert': 'true',
      },
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve();
        else reject(new Error(`HTTP ${res.statusCode}: ${body}`));
      });
    });
    req.on('error', reject);
    req.write(fileBuf);
    req.end();
  });
}

function* walk(dir, base = dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full, base);
    else yield { full, rel: path.relative(base, full) };
  }
}

async function main() {
  console.log(`🚀 Uploading from ${MEDIA_DIR} to ${SUPABASE_URL}\n`);
  let ok = 0, skip = 0, fail = 0;

  for (const bucket of Object.keys(BUCKETS)) {
    const bucketDir = path.join(MEDIA_DIR, bucket);
    if (!fs.existsSync(bucketDir)) {
      console.log(`⏭  ${bucket}: no local files`);
      continue;
    }
    const files = [...walk(bucketDir)];
    console.log(`📦 ${bucket}: ${files.length} files`);
    
    for (const { full, rel } of files) {
      const objPath = rel.split(path.sep).join('/');
      const ext = path.extname(rel).toLowerCase();
      const mime = MIMES[ext] || 'application/octet-stream';
      const buf = fs.readFileSync(full);
      try {
        await uploadFile(bucket, objPath, buf, mime);
        ok++;
        if (ok % 25 === 0) process.stdout.write(`   ${ok} uploaded...\n`);
      } catch (e) {
        fail++;
        console.error(`   ❌ ${bucket}/${objPath}: ${e.message.slice(0,120)}`);
      }
    }
  }

  console.log(`\n🎉 Done!\n   ✅ Uploaded: ${ok}\n   ⏭  Skipped: ${skip}\n   ❌ Failed: ${fail}`);
}

main().catch(console.error);
