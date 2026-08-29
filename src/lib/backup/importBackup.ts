import JSZip from 'jszip';
import { putTable, putMedia, saveMeta, clearAll, type BackupMeta } from './offlineStore';

export interface ImportProgress {
  phase: 'reading' | 'tables' | 'media' | 'done';
  message: string;
  current?: number;
  total?: number;
}

export async function importBackup(
  file: File,
  onProgress?: (p: ImportProgress) => void,
): Promise<BackupMeta> {
  onProgress?.({ phase: 'reading', message: 'در حال باز کردن فایل بکاپ...' });

  // Ask the browser to keep this data (prevents eviction of large offline backups)
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist();
    }
  } catch {}

  const zip = await JSZip.loadAsync(file);
  const manifestFile = zip.file('manifest.json');
  if (!manifestFile) throw new Error('فایل manifest.json یافت نشد — بکاپ نامعتبر است');
  const manifest = JSON.parse(await manifestFile.async('string'));

  // Wipe previous import
  await clearAll();

  // Tables
  const tableFiles = Object.keys(zip.files).filter(
    (p) => p.startsWith('data/') && p.endsWith('.json'),
  );
  let tableCount = 0;
  let totalRecords = 0;
  for (const path of tableFiles) {
    const name = path.slice('data/'.length, -'.json'.length);
    const text = await zip.files[path].async('string');
    const rows = JSON.parse(text);
    await putTable(name, rows);
    totalRecords += Array.isArray(rows) ? rows.length : 0;
    tableCount++;
    onProgress?.({
      phase: 'tables',
      message: `جداول: ${tableCount} از ${tableFiles.length}`,
      current: tableCount,
      total: tableFiles.length,
    });
  }

  // Media
  const mediaFiles = Object.keys(zip.files).filter(
    (p) => p.startsWith('media/') && !zip.files[p].dir,
  );
  let mediaDone = 0;
  // Process in small parallel batches
  const BATCH = 8;
  for (let i = 0; i < mediaFiles.length; i += BATCH) {
    const slice = mediaFiles.slice(i, i + BATCH);
    await Promise.all(
      slice.map(async (p) => {
        try {
          const blob = await zip.files[p].async('blob');
          const relative = p.slice('media/'.length); // bucket/path/...
          const ext = relative.split('.').pop()?.toLowerCase() || '';
          const mime =
            ext === 'jpg' || ext === 'jpeg'
              ? 'image/jpeg'
              : ext === 'png'
              ? 'image/png'
              : ext === 'webp'
              ? 'image/webp'
              : ext === 'pdf'
              ? 'application/pdf'
              : ext === 'mp4'
              ? 'video/mp4'
              : ext === 'mp3'
              ? 'audio/mpeg'
              : 'application/octet-stream';
          await putMedia(relative, blob, mime);
        } catch (e) {
          console.warn('Media import failed:', p, e);
        }
      }),
    );
    mediaDone += slice.length;
    onProgress?.({
      phase: 'media',
      message: `رسانه‌ها: ${mediaDone} از ${mediaFiles.length}`,
      current: mediaDone,
      total: mediaFiles.length,
    });
  }

  const meta: BackupMeta = {
    importedAt: Date.now(),
    createdAt: manifest.createdAt,
    scope: manifest.scope || 'user',
    totalRecords: manifest.totalRecords ?? totalRecords,
    totalMedia: mediaFiles.length,
    tableCounts: manifest.tableCounts || {},
  };
  await saveMeta(meta);

  // اطلاع‌رسانی به وقفه‌گیر آفلاین که بکاپ در دسترس است
  try { window.dispatchEvent(new Event('ahrom:backup-imported')); } catch {}

  onProgress?.({ phase: 'done', message: 'بکاپ با موفقیت بارگذاری شد' });
  return meta;
}
