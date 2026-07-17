import JSZip from 'jszip';
import { supabase } from '@/integrations/supabase/client';

export type ExportScope = 'user' | 'full';

export interface ExportProgress {
  phase: 'data' | 'media' | 'zipping' | 'done';
  message: string;
  current?: number;
  total?: number;
  bytes?: number;
  totalBytes?: number;
}

export interface ExportOptions {
  /** Whether to include images/videos/files inside the backup ZIP. Default: false */
  includeMedia?: boolean;
}

function fmtBytes(b: number): string {
  if (!Number.isFinite(b) || b <= 0) return '0 B';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

const PUBLIC_BUCKETS = [
  'executive-progress',
  'avatars',
  'profile-images',
  'order-media',
  'project-media',
];

// Regex #1: Full Supabase storage URLs (public/authenticated/signed).
// Regex #2: Bare `<bucket>/<path>` references (no leading slash / URL).
const BUCKET_ALT = PUBLIC_BUCKETS.join('|');
const STORAGE_URL_RE = new RegExp(
  `/storage/v1/object/(?:public/|authenticated/|sign/)?(${BUCKET_ALT})/([^"'?#\\s)\\]]+)`,
  'g',
);
const BARE_BUCKET_RE = new RegExp(
  `(?:^|[^A-Za-z0-9_-])((?:${BUCKET_ALT})/[A-Za-z0-9_./%-]+\\.[A-Za-z0-9]{2,6})`,
  'g',
);

/**
 * Deep-scan every string in an arbitrary value tree for references to Supabase
 * Storage assets in our known public buckets. Column names are NOT used —
 * detection is purely regex-based so fields like `logo`, `cover`, `document`,
 * `snapshot`, etc. are all picked up automatically.
 *
 * Iterative (stack-based) to survive extremely deep JSON without a stack overflow.
 */
function collectMediaCandidates(root: any, out: Set<string>) {
  const stack: any[] = [root];
  const seen = new WeakSet<object>();
  while (stack.length) {
    const cur = stack.pop();
    if (cur === null || cur === undefined) continue;
    const t = typeof cur;
    if (t === 'string') {
      if (cur.length < 4 || cur.length > 5000) continue;
      let m: RegExpExecArray | null;
      STORAGE_URL_RE.lastIndex = 0;
      while ((m = STORAGE_URL_RE.exec(cur)) !== null) {
        out.add(`${m[1]}/${decodeURIComponent(m[2])}`);
      }
      BARE_BUCKET_RE.lastIndex = 0;
      while ((m = BARE_BUCKET_RE.exec(cur)) !== null) {
        out.add(m[1]);
      }
      continue;
    }
    if (t !== 'object') continue;
    if (seen.has(cur)) continue;
    seen.add(cur);
    if (Array.isArray(cur)) {
      for (let i = 0; i < cur.length; i++) stack.push(cur[i]);
    } else {
      for (const k in cur) if (Object.prototype.hasOwnProperty.call(cur, k)) stack.push(cur[k]);
    }
  }
}

export async function exportBackup(
  scope: ExportScope,
  onProgress?: (p: ExportProgress) => void,
  options: ExportOptions = {},
): Promise<Blob> {
  const includeMedia = options.includeMedia === true;

  onProgress?.({ phase: 'data', message: 'در حال دریافت داده‌ها از سرور...' });

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('احراز هویت لازم است');

  const fnName = scope === 'full' ? 'full-backup' : 'user-backup';
  const { data: payload, error } = await supabase.functions.invoke(fnName);
  if (error) throw new Error(error.message || 'خطا در دریافت داده');
  if (!payload || !payload.tables) throw new Error('پاسخ نامعتبر از سرور');

  const tables: Record<string, any[]> = payload.tables;

  const zip = new JSZip();
  zip.file(
    'manifest.json',
    JSON.stringify(
      {
        version: 1,
        scope,
        createdAt: payload.created_at,
        createdBy: payload.created_by,
        totalRecords: payload.total_records,
        tableCounts: payload.table_counts,
        errors: payload.errors,
        includeMedia,
      },
      null,
      2,
    ),
  );

  const dataDir = zip.folder('data')!;
  for (const [tableName, rows] of Object.entries(tables)) {
    dataDir.file(`${tableName}.json`, JSON.stringify(rows));
  }

  if (includeMedia) {
    // Collect media candidates
    const candidates = new Set<string>();
    for (const rows of Object.values(tables)) {
      for (const row of rows) collectMediaCandidates(row, candidates);
    }

    const mediaDir = zip.folder('media')!;
    const candidatesArr = Array.from(candidates);
    const BATCH = 6;
    let downloaded = 0;
    let succeeded = 0;
    let bytes = 0;

    onProgress?.({
      phase: 'media',
      message: `در حال دانلود رسانه‌ها... 0 از ${candidatesArr.length}`,
      current: 0,
      total: candidatesArr.length,
      bytes: 0,
    });

    async function downloadOne(rawPath: string): Promise<void> {
      let bucket: string | null = null;
      let path = rawPath;
      const firstSeg = rawPath.split('/')[0];
      if (PUBLIC_BUCKETS.includes(firstSeg)) {
        bucket = firstSeg;
        path = rawPath.slice(firstSeg.length + 1);
      }
      const tryBuckets = bucket ? [bucket] : PUBLIC_BUCKETS;
      for (const b of tryBuckets) {
        try {
          const { data: blob, error: dlErr } = await supabase.storage
            .from(b)
            .download(bucket ? path : rawPath);
          if (!dlErr && blob && blob.size > 0) {
            mediaDir.file(`${b}/${bucket ? path : rawPath}`, blob);
            succeeded++;
            bytes += blob.size;
            return;
          }
        } catch {
          /* try next */
        }
      }
    }

    for (let i = 0; i < candidatesArr.length; i += BATCH) {
      const slice = candidatesArr.slice(i, i + BATCH);
      await Promise.all(slice.map(downloadOne));
      downloaded += slice.length;
      onProgress?.({
        phase: 'media',
        message: `رسانه‌ها: ${downloaded} از ${candidatesArr.length} (${succeeded} موفق) — ${fmtBytes(bytes)}`,
        current: downloaded,
        total: candidatesArr.length,
        bytes,
      });
    }
  }

  onProgress?.({ phase: 'zipping', message: 'در حال فشرده‌سازی فایل...' });

  const blob = await zip.generateAsync(
    { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
    (m) => {
      const pct = Math.round(m.percent);
      const cb = (m as any).currentFile ? ` — ${(m as any).currentFile}` : '';
      onProgress?.({
        phase: 'zipping',
        message: `فشرده‌سازی: ${pct}%${cb}`,
        current: pct,
        total: 100,
      });
    },
  );

  onProgress?.({
    phase: 'done',
    message: `آماده دانلود — حجم: ${fmtBytes(blob.size)}`,
    bytes: blob.size,
    totalBytes: blob.size,
  });
  return blob;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
