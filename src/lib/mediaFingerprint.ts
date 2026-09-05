import { supabase } from '@/integrations/supabase/client';

/**
 * تشخیص فایل‌های تکراری (خصوصاً فیلم) برای هر سفارش
 * - hash محتوای فایل (SHA-256) → تشخیص دقیق فایل کاملاً یکسان
 * - مدت‌زمان ویدیو + حجم → تشخیص هوشمند نسخه‌های بازفشرده/ارسال‌شده از مسیرهای مختلف
 */

/** SHA-256 محتوای فایل به‌صورت hex */
export async function computeFileHash(file: File | Blob): Promise<string | null> {
  try {
    if (!crypto?.subtle) return null;
    const buffer = await file.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } catch (err) {
    console.warn('computeFileHash failed', err);
    return null;
  }
}

/** مدت‌زمان ویدیو به ثانیه (اگر قابل خواندن باشد) */
export function getVideoDuration(file: File | Blob): Promise<number | null> {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(file);
      const video = document.createElement('video');
      let done = false;
      const finish = (value: number | null) => {
        if (done) return;
        done = true;
        URL.revokeObjectURL(url);
        resolve(value);
      };
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        const d = video.duration;
        finish(Number.isFinite(d) && d > 0 ? Math.round(d * 100) / 100 : null);
      };
      video.onerror = () => finish(null);
      setTimeout(() => finish(null), 8000);
      video.src = url;
    } catch {
      resolve(null);
    }
  });
}

export interface MediaFingerprint {
  contentHash: string | null;
  durationSeconds: number | null;
}

export async function buildMediaFingerprint(
  file: File,
  type: 'image' | 'video'
): Promise<MediaFingerprint> {
  const [contentHash, durationSeconds] = await Promise.all([
    computeFileHash(file),
    type === 'video' ? getVideoDuration(file) : Promise.resolve(null),
  ]);
  return { contentHash, durationSeconds };
}

/**
 * آیا این فایل قبلاً برای همین سفارش ثبت شده است؟
 * ۱) hash یکسان  ۲) ویدیو با مدت‌زمان یکسان (±۰.۵ ثانیه) و حجم نزدیک (±۳٪)
 */
export async function findDuplicateProjectMedia(
  projectId: string,
  opts: {
    contentHash?: string | null;
    durationSeconds?: number | null;
    fileSize?: number | null;
    fileType?: string | null;
    filePath?: string | null;
  }
): Promise<{ id: string; file_path: string } | null> {
  try {
    const { data } = await supabase
      .from('project_media')
      .select('id, file_path, file_size, file_type, content_hash, duration_seconds')
      .eq('project_id', projectId);

    const rows = data || [];
    if (rows.length === 0) return null;

    if (opts.filePath) {
      const samePath = rows.find((r: any) => r.file_path === opts.filePath);
      if (samePath) return { id: samePath.id, file_path: samePath.file_path };
    }

    if (opts.contentHash) {
      const sameHash = rows.find((r: any) => r.content_hash === opts.contentHash);
      if (sameHash) return { id: sameHash.id, file_path: sameHash.file_path };
    }

    if (opts.fileType === 'video' && opts.durationSeconds) {
      const near = rows.find((r: any) => {
        if (r.file_type !== 'video' || !r.duration_seconds) return false;
        const durOk = Math.abs(Number(r.duration_seconds) - Number(opts.durationSeconds)) <= 0.5;
        if (!durOk) return false;
        if (!opts.fileSize || !r.file_size) return true;
        const diff = Math.abs(Number(r.file_size) - Number(opts.fileSize));
        return diff / Math.max(Number(r.file_size), Number(opts.fileSize)) <= 0.03;
      });
      if (near) return { id: near.id, file_path: near.file_path };
    }

    return null;
  } catch (err) {
    console.warn('findDuplicateProjectMedia failed', err);
    return null;
  }
}

/** کلید یکتای نمایش برای حذف تکراری‌ها در گالری (روی داده‌های قدیمی هم کار می‌کند) */
export function mediaDedupeKey(m: {
  file_path?: string | null;
  file_type?: string | null;
  file_size?: number | null;
  content_hash?: string | null;
  duration_seconds?: number | null;
}): string {
  if (m.content_hash) return `h:${m.content_hash}`;
  if (m.file_type === 'video' && m.duration_seconds && m.file_size) {
    return `v:${Math.round(Number(m.duration_seconds) * 10)}:${m.file_size}`;
  }
  if (m.file_size && m.file_type) return `s:${m.file_type}:${m.file_size}`;
  return `p:${m.file_path || Math.random()}`;
}
