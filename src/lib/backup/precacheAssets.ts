/**
 * Force-load every lazy chunk of the app so the Service Worker caches
 * all JS/CSS needed to run any route while offline.
 *
 * Uses Vite's import.meta.glob to enumerate every module under src/.
 * Calling each importer triggers the network fetch for the chunk, which
 * the SW (Stale-While-Revalidate) then stores in the runtime cache.
 */

import { supabase } from '@/integrations/supabase/client';
import { forEachTableRow, getMedia, listTables, putMedia } from './offlineStore';

export interface PrecacheProgress {
  current: number;
  total: number;
  failed: number;
  message: string;
  bytes?: number;
}

// eager:false → returns a map of path → () => import(path)
const allModules = import.meta.glob('/src/**/*.{ts,tsx,js,jsx,css}');

export async function precacheAppAssets(
  onProgress?: (p: PrecacheProgress) => void,
): Promise<{ total: number; loaded: number; failed: number }> {
  const entries = Object.entries(allModules);
  const total = entries.length;
  let loaded = 0;
  let failed = 0;

  // batch to avoid hammering the browser
  const BATCH = 8;
  for (let i = 0; i < entries.length; i += BATCH) {
    const slice = entries.slice(i, i + BATCH);
    await Promise.all(
      slice.map(async ([path, importer]) => {
        try {
          await importer();
          loaded++;
        } catch (e) {
          failed++;
          console.warn('[precache] failed', path, e);
        }
        onProgress?.({
          current: loaded + failed,
          total,
          failed,
          message: `بارگیری فایل‌های برنامه برای حالت آفلاین... ${loaded + failed} از ${total}`,
        });
      }),
    );
  }

  // Also force the SW to cache index.html and manifest by re-fetching them
  try {
    await Promise.all([
      fetch('/', { cache: 'reload' }).catch(() => null),
      fetch('/index.html', { cache: 'reload' }).catch(() => null),
      fetch('/manifest.webmanifest?v=13', { cache: 'reload' }).catch(() => null),
    ]);
  } catch {}

  return { total, loaded, failed };
}

// ==================== Map Tile Precache ====================

/**
 * Iran bounding box (approx): lat 25..40, lng 44..63.
 * We precache OSM raster tiles for zoom 3..8 which covers country → city level.
 * Total tiles ≈ 250. Service worker (v29+) caches cross-origin tile hosts.
 */
const IRAN_BOUNDS = { minLat: 25, maxLat: 40, minLng: 44, maxLng: 63 };
const TILE_ZOOMS = [3, 4, 5, 6, 7, 8];

function lng2tile(lng: number, z: number): number {
  return Math.floor(((lng + 180) / 360) * Math.pow(2, z));
}
function lat2tile(lat: number, z: number): number {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, z),
  );
}

export async function precacheMapTiles(
  onProgress?: (p: PrecacheProgress) => void,
): Promise<{ total: number; loaded: number; failed: number }> {
  const urls: string[] = [];
  for (const z of TILE_ZOOMS) {
    const xMin = lng2tile(IRAN_BOUNDS.minLng, z);
    const xMax = lng2tile(IRAN_BOUNDS.maxLng, z);
    const yMin = lat2tile(IRAN_BOUNDS.maxLat, z);
    const yMax = lat2tile(IRAN_BOUNDS.minLat, z);
    for (let x = xMin; x <= xMax; x++) {
      for (let y = yMin; y <= yMax; y++) {
        urls.push(`https://tile.openstreetmap.org/${z}/${x}/${y}.png`);
      }
    }
  }
  // چند فایل ثابت Leaflet نیز که از unpkg بارگذاری می‌شوند
  urls.push(
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  );

  const total = urls.length;
  let loaded = 0;
  let failed = 0;
  const BATCH = 6;
  for (let i = 0; i < urls.length; i += BATCH) {
    const slice = urls.slice(i, i + BATCH);
    await Promise.all(
      slice.map(async (u) => {
        try {
          // درخواست معمولی — Service Worker خودش پاسخ را کش می‌کند
          const r = await fetch(u, { mode: 'cors', credentials: 'omit' });
          if (r.ok || r.type === 'opaque') loaded++;
          else failed++;
        } catch {
          failed++;
        }
        onProgress?.({
          current: loaded + failed,
          total,
          failed,
          message: `پیش‌کش تایل‌های نقشه ایران... ${loaded + failed} از ${total}`,
        });
      }),
    );
  }
  return { total, loaded, failed };
}

// ==================== Backup Media Hydration ====================

const MEDIA_BUCKETS = [
  'project-media',
  'profile-images',
  'executive-progress',
  'avatars',
  'order-media',
];

const MEDIA_BUCKET_SET = new Set(MEDIA_BUCKETS);
const MEDIA_EXT_RE = /\.(?:avif|bmp|gif|heic|heif|jpeg|jpg|m4a|m4v|mov|mp3|mp4|mpeg|ogg|pdf|png|svg|wav|webm|webp)(?:$|[?#])/i;
const STORAGE_URL_RE = /\/storage\/v1\/(?:object|render\/image)\/(?:public\/|authenticated\/|sign\/)?([^/\s?#]+)\/([^\s"'<>]+?)(?=$|[\s"'<>?#])/gi;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function guessMime(path: string, fallback?: string | null): string {
  if (fallback && /^(image|video|audio)\//i.test(fallback)) return fallback;
  const ext = path.split('?')[0].split('#')[0].split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'avif': return 'image/avif';
    case 'gif': return 'image/gif';
    case 'heic': return 'image/heic';
    case 'heif': return 'image/heif';
    case 'jpeg':
    case 'jpg': return 'image/jpeg';
    case 'png': return 'image/png';
    case 'svg': return 'image/svg+xml';
    case 'webp': return 'image/webp';
    case 'm4v':
    case 'mp4': return 'video/mp4';
    case 'mov': return 'video/quicktime';
    case 'webm': return 'video/webm';
    case 'mp3': return 'audio/mpeg';
    case 'wav': return 'audio/wav';
    case 'ogg': return 'audio/ogg';
    case 'pdf': return 'application/pdf';
    default: return fallback || 'application/octet-stream';
  }
}

function normalizePath(path: string): string {
  return decodeURIComponent(path).replace(/^\/+/, '').split('?')[0].split('#')[0];
}

function addCandidate(bucket: string | null | undefined, path: string | null | undefined, out: Set<string>) {
  if (!path) return;
  let cleanPath = normalizePath(String(path));
  let cleanBucket = bucket ? String(bucket).trim() : '';
  if (/^https?:\/\//i.test(cleanPath)) return;

  const firstSlash = cleanPath.indexOf('/');
  if ((!cleanBucket || !MEDIA_BUCKET_SET.has(cleanBucket)) && firstSlash > 0) {
    const first = cleanPath.slice(0, firstSlash);
    if (MEDIA_BUCKET_SET.has(first)) {
      cleanBucket = first;
      cleanPath = cleanPath.slice(firstSlash + 1);
    }
  }

  if (!cleanBucket || !MEDIA_BUCKET_SET.has(cleanBucket)) return;
  if (!cleanPath || !MEDIA_EXT_RE.test(cleanPath)) return;
  out.add(`${cleanBucket}/${cleanPath}`);
}

function scanStringForMedia(value: string, out: Set<string>, currentBucket?: string) {
  if (!value || value.length > 6000) return;

  STORAGE_URL_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = STORAGE_URL_RE.exec(value)) !== null) {
    addCandidate(match[1], match[2], out);
  }

  if (MEDIA_EXT_RE.test(value)) {
    addCandidate(currentBucket, value, out);
    addCandidate(undefined, value, out);
  }
}

function collectMediaFromValue(root: any, out: Set<string>, currentBucket?: string) {
  const stack: Array<{ value: any; bucket?: string }> = [{ value: root, bucket: currentBucket }];
  const seen = new WeakSet<object>();

  while (stack.length) {
    const { value, bucket } = stack.pop()!;
    if (value === null || value === undefined) continue;

    if (typeof value === 'string') {
      scanStringForMedia(value, out, bucket);
      continue;
    }

    if (typeof value !== 'object') continue;
    if (seen.has(value)) continue;
    seen.add(value);

    const rowBucket =
      typeof value.bucket === 'string' ? value.bucket :
      typeof value.storage_bucket === 'string' ? value.storage_bucket :
      typeof value.bucket_name === 'string' ? value.bucket_name :
      bucket;

    const directPath =
      value.file_path ?? value.path ?? value.storage_path ?? value.media_path ??
      value.thumbnail_path ?? value.avatar_path ?? value.photo_path;
    if (typeof directPath === 'string') addCandidate(rowBucket, directPath, out);

    if (Array.isArray(value)) {
      for (const child of value) stack.push({ value: child, bucket: rowBucket });
    } else {
      for (const key in value) {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
          const nextBucket = /bucket/i.test(key) && typeof value[key] === 'string' ? value[key] : rowBucket;
          stack.push({ value: value[key], bucket: nextBucket });
        }
      }
    }
  }
}

async function discoverBackupMediaCandidates(
  onProgress?: (p: PrecacheProgress) => void,
): Promise<string[]> {
  const tables = await listTables();
  const candidates = new Set<string>();
  let scanned = 0;

  for (const table of tables) {
    try {
      const defaultBucket = /profile|avatar|photo/i.test(table) ? 'profile-images' : 'project-media';
      await forEachTableRow(table, (row) => collectMediaFromValue(row, candidates, defaultBucket), { yieldEvery: 400 });
    } catch (error) {
      console.warn('[offline-media] scan failed', table, error);
    }
    scanned++;
    onProgress?.({
      current: scanned,
      total: tables.length,
      failed: 0,
      message: `در حال شناسایی رسانه‌های بکاپ... ${scanned} از ${tables.length} جدول`,
    });
    await sleep(0);
  }

  return Array.from(candidates);
}

async function downloadMediaCandidate(key: string): Promise<{ ok: boolean; bytes: number; skipped: boolean }> {
  const cached = await getMedia(key);
  if (cached?.blob?.size) return { ok: true, bytes: 0, skipped: true };

  const slash = key.indexOf('/');
  if (slash <= 0) return { ok: false, bytes: 0, skipped: false };
  const bucket = key.slice(0, slash);
  const path = key.slice(slash + 1);

  try {
    const { data: blob, error } = await supabase.storage.from(bucket).download(path);
    if (error || !blob || blob.size <= 0) return { ok: false, bytes: 0, skipped: false };
    await putMedia(key, blob, guessMime(path, blob.type));
    return { ok: true, bytes: blob.size, skipped: false };
  } catch {
    return { ok: false, bytes: 0, skipped: false };
  }
}

/**
 * Download every media file referenced by the imported backup records into the
 * offline IndexedDB media store. This makes the "Install for offline use"
 * button hydrate photos/videos even when the ZIP backup did not include them.
 */
export async function hydrateBackupMedia(
  onProgress?: (p: PrecacheProgress) => void,
): Promise<{ total: number; loaded: number; failed: number; skipped: number; bytes: number }> {
  const candidates = await discoverBackupMediaCandidates(onProgress);
  const total = candidates.length;
  let loaded = 0;
  let failed = 0;
  let skipped = 0;
  let bytes = 0;

  if (total === 0) {
    onProgress?.({ current: 0, total: 0, failed: 0, bytes: 0, message: 'رسانه‌ای برای ذخیره آفلاین پیدا نشد' });
    return { total, loaded, failed, skipped, bytes };
  }

  const BATCH = 3;
  for (let i = 0; i < candidates.length; i += BATCH) {
    const slice = candidates.slice(i, i + BATCH);
    const results = await Promise.all(slice.map(downloadMediaCandidate));
    for (const result of results) {
      if (result.ok) {
        loaded++;
        if (result.skipped) skipped++;
        bytes += result.bytes;
      } else {
        failed++;
      }
    }

    onProgress?.({
      current: loaded + failed,
      total,
      failed,
      bytes,
      message: `بارگیری عکس‌ها و فیلم‌ها برای آفلاین... ${loaded + failed} از ${total} (${loaded} موفق، ${failed} ناموفق)`,
    });
    await sleep(0);
  }

  return { total, loaded, failed, skipped, bytes };
}
