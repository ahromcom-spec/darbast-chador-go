import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type TransferKind = 'upload' | 'download';
export type TransferStatus = 'active' | 'done' | 'error';

export interface MediaTransfer {
  id: string;
  kind: TransferKind;
  label: string;
  percentage: number;
  loaded: number;
  total: number;
  status: TransferStatus;
  error?: string;
  startedAt: number;
}

type Listener = (transfers: MediaTransfer[]) => void;

const transfers = new Map<string, MediaTransfer>();
const listeners = new Set<Listener>();

const snapshot = () =>
  Array.from(transfers.values()).sort((a, b) => b.startedAt - a.startedAt);

const emit = () => {
  const list = snapshot();
  listeners.forEach((l) => l(list));
};

const newId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

/** Registers a new transfer and returns helpers to update it. */
export const startTransfer = (kind: TransferKind, label: string, total = 0) => {
  const id = newId();
  transfers.set(id, {
    id,
    kind,
    label,
    percentage: 0,
    loaded: 0,
    total,
    status: 'active',
    startedAt: Date.now(),
  });
  emit();

  const update = (loaded: number, totalBytes?: number) => {
    const t = transfers.get(id);
    if (!t) return;
    const totalVal = totalBytes ?? t.total;
    t.loaded = loaded;
    t.total = totalVal;
    t.percentage = totalVal > 0 ? Math.min(99, Math.round((loaded / totalVal) * 100)) : t.percentage;
    emit();
  };

  const finish = () => {
    const t = transfers.get(id);
    if (!t) return;
    t.percentage = 100;
    t.loaded = t.total;
    t.status = 'done';
    emit();
    setTimeout(() => {
      transfers.delete(id);
      emit();
    }, 2500);
  };

  const fail = (message?: string) => {
    const t = transfers.get(id);
    if (!t) return;
    t.status = 'error';
    t.error = message;
    emit();
    setTimeout(() => {
      transfers.delete(id);
      emit();
    }, 6000);
  };

  return { id, update, finish, fail };
};

/** Subscribe to all active transfers (uploads + downloads). */
export const useMediaTransfers = () => {
  const [list, setList] = useState<MediaTransfer[]>(snapshot);
  useEffect(() => {
    const listener: Listener = (l) => setList(l);
    listeners.add(listener);
    setList(snapshot());
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return list;
};

export const formatBytes = (bytes: number) => {
  if (!bytes || bytes < 0) return '0';
  if (bytes < 1024) return `${bytes} بایت`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} کیلوبایت`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} مگابایت`;
};

interface UploadOptions {
  bucket: string;
  path: string;
  file: File;
  label?: string;
  upsert?: boolean;
  contentType?: string;
  onProgress?: (percentage: number, loaded: number, total: number) => void;
}

/** فایل‌های بزرگ‌تر از این حجم با آپلود قابل ادامه (resumable) فرستاده می‌شوند */
const RESUMABLE_THRESHOLD = 8 * 1024 * 1024;

/** آپلود قابل ادامه برای فایل‌های حجیم (چانک ۶ مگابایتی) */
const uploadResumable = async ({
  bucket,
  path,
  file,
  label,
  upsert = true,
  contentType,
  onProgress,
}: UploadOptions): Promise<{ path: string }> => {
  const [{ Upload }, { data: { session } }] = await Promise.all([
    import('tus-js-client'),
    supabase.auth.getSession(),
  ]);

  if (!session) throw new Error('Not authenticated');

  const tracker = startTransfer('upload', label || file.name, file.size);
  const baseUrl = import.meta.env.VITE_SUPABASE_URL;

  return new Promise((resolve, reject) => {
    const upload = new Upload(file, {
      endpoint: `${baseUrl}/storage/v1/upload/resumable`,
      retryDelays: [0, 2000, 5000, 10000, 20000],
      chunkSize: 6 * 1024 * 1024,
      removeFingerprintOnSuccess: true,
      uploadDataDuringCreation: true,
      headers: {
        authorization: `Bearer ${session.access_token}`,
        'x-upsert': upsert ? 'true' : 'false',
      },
      metadata: {
        bucketName: bucket,
        objectName: path,
        contentType: contentType || file.type || 'video/mp4',
        cacheControl: '3600',
      },
      onProgress: (loaded, total) => {
        tracker.update(loaded, total);
        onProgress?.(Math.min(99, Math.round((loaded / total) * 100)), loaded, total);
      },
      onSuccess: () => {
        tracker.finish();
        onProgress?.(100, file.size, file.size);
        resolve({ path });
      },
      onError: (error) => {
        const msg = (error as Error)?.message || 'خطا در آپلود';
        tracker.fail(msg);
        reject(new Error(msg));
      },
    });

    upload.findPreviousUploads().then((prev) => {
      if (prev.length) upload.resumeFromPreviousUpload(prev[0]);
      upload.start();
    });
  });
};

/**
 * Uploads a file to Supabase Storage with real-time progress reporting,
 * registering the transfer in the global progress panel.
 */
export const uploadToStorageWithProgress = (options: UploadOptions): Promise<{ path: string }> => {
  if (options.file.size > RESUMABLE_THRESHOLD) {
    return uploadResumable(options);
  }
  return uploadSingleRequest(options);
};

const uploadSingleRequest = ({
  bucket,
  path,
  file,
  label,
  upsert = true,
  contentType,
  onProgress,
}: UploadOptions): Promise<{ path: string }> => {
  const tracker = startTransfer('upload', label || file.name, file.size);

  return new Promise((resolve, reject) => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        tracker.fail('ورود انجام نشده است');
        reject(new Error('Not authenticated'));
        return;
      }

      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (event) => {
        if (!event.lengthComputable) return;
        tracker.update(event.loaded, event.total);
        onProgress?.(
          Math.min(99, Math.round((event.loaded / event.total) * 100)),
          event.loaded,
          event.total
        );
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          tracker.finish();
          onProgress?.(100, file.size, file.size);
          resolve({ path });
        } else {
          let detail = '';
          try {
            const body = JSON.parse(xhr.responseText || '{}');
            detail = body?.message || body?.error || '';
          } catch {
            detail = xhr.responseText || '';
          }
          tracker.fail(detail || `خطا ${xhr.status}`);
          reject(new Error(detail || `Upload failed: ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => {
        tracker.fail('خطای شبکه');
        reject(new Error('خطای شبکه در آپلود'));
      });

      const baseUrl = import.meta.env.VITE_SUPABASE_URL;
      xhr.open('POST', `${baseUrl}/storage/v1/object/${bucket}/${path}`);
      xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`);
      if (upsert) xhr.setRequestHeader('x-upsert', 'true');
      if (contentType || file.type) {
        xhr.setRequestHeader('Content-Type', contentType || file.type);
      }
      xhr.send(file);
    });
  });
};

/**
 * Tracks buffering/download progress of a <video> element and shows it
 * in the global progress panel until playback data is ready.
 */
export const trackVideoDownload = (el: HTMLVideoElement, label: string) => {
  let tracker: ReturnType<typeof startTransfer> | null = null;
  let finished = false;

  const ensure = () => {
    if (!tracker && !finished) tracker = startTransfer('download', label, 100);
    return tracker;
  };

  let lastPercent = -100;
  const onProgress = () => {
    if (finished) return;
    const duration = el.duration;
    if (!duration || !isFinite(duration) || el.buffered.length === 0) return;
    const buffered = el.buffered.end(el.buffered.length - 1);
    const percent = Math.round((buffered / duration) * 100);
    // به‌روزرسانی کم‌تعداد تا پخش روی گوشی موبایل روان و بدون مکث بماند
    if (percent - lastPercent < 5 && percent < 99) return;
    lastPercent = percent;
    const t = ensure();
    t?.update(percent, 100);
    if (percent >= 99) {
      finished = true;
      t?.finish();
      tracker = null;
    }
  };

  const onLoadStart = () => ensure();
  const onDone = () => {
    if (finished) return;
    finished = true;
    tracker?.finish();
    tracker = null;
  };
  const onError = () => {
    if (finished) return;
    finished = true;
    tracker?.fail('خطا در دریافت ویدیو');
    tracker = null;
  };

  el.addEventListener('loadstart', onLoadStart);
  el.addEventListener('progress', onProgress);
  el.addEventListener('canplaythrough', onDone);
  el.addEventListener('error', onError);

  return () => {
    el.removeEventListener('loadstart', onLoadStart);
    el.removeEventListener('progress', onProgress);
    el.removeEventListener('canplaythrough', onDone);
    el.removeEventListener('error', onError);
    if (!finished) {
      finished = true;
      tracker?.finish();
    }
  };
};
