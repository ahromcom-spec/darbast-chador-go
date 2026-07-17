import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Download, Upload, Trash2, Database, HardDrive, Wifi, WifiOff, RefreshCw, ListChecks, Image as ImageIcon, PackageCheck } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { hydrateBackupMedia, precacheAppAssets, precacheMapTiles, type PrecacheProgress } from '@/lib/backup/precacheAssets';
import { exportBackup, downloadBlob, type ExportProgress, type ExportScope } from '@/lib/backup/exportBackup';
import { importBackup, type ImportProgress } from '@/lib/backup/importBackup';
import { getMeta, clearAll, countMedia, saveMeta, type BackupMeta } from '@/lib/backup/offlineStore';
import { usePendingMutations } from '@/hooks/usePendingMutations';
import { toast } from '@/hooks/use-toast';

interface BackupPanelProps {
  scope?: ExportScope;
  title?: string;
  description?: string;
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatDate(iso?: string | number) {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString('fa-IR');
  } catch {
    return String(iso);
  }
}

interface StorageQuota {
  usage: number;
  quota: number;
  supported: boolean;
}

export default function BackupPanel({ scope = 'user', title, description }: BackupPanelProps) {
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [meta, setMeta] = useState<BackupMeta | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  // پیش‌فرض روشن — بدون رسانه، بکاپ آفلاین عکس/فیلم مشتریان را نمایش نمی‌دهد
  const [includeMedia, setIncludeMedia] = useState(true);
  const [precaching, setPrecaching] = useState(false);
  const [precacheProgress, setPrecacheProgress] = useState<PrecacheProgress | null>(null);
  const [quota, setQuota] = useState<StorageQuota | null>(null);
  const [refreshingQuota, setRefreshingQuota] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const pending = usePendingMutations();

  async function refreshQuota() {
    setRefreshingQuota(true);
    // Timeout guard so UI never appears stuck if the browser hangs on estimate()
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000));
    try {
      if (navigator.storage && typeof navigator.storage.estimate === 'function') {
        const est = await Promise.race([navigator.storage.estimate(), timeout]);
        if (est) {
          setQuota({
            usage: (est as StorageEstimate).usage || 0,
            quota: (est as StorageEstimate).quota || 0,
            supported: true,
          });
        }
      } else {
        setQuota({ usage: 0, quota: 0, supported: false });
      }
    } catch {
      setQuota((prev) => prev ?? { usage: 0, quota: 0, supported: false });
    } finally {
      // small delay so the spinner is visible even when estimate() is instant
      setTimeout(() => setRefreshingQuota(false), 300);
    }
  }

  useEffect(() => {
    getMeta().then(setMeta);
    refreshQuota();
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  async function handleExport() {
    if (!online) {
      toast({ title: 'اتصال اینترنت لازم است', description: 'برای دانلود بکاپ باید آنلاین باشید', variant: 'destructive' });
      return;
    }
    setExporting(true);
    setExportProgress({ phase: 'data', message: 'شروع...' });
    try {
      const blob = await exportBackup(scope, setExportProgress, { includeMedia });
      const date = new Date().toISOString().slice(0, 10);
      const suffix = includeMedia ? 'with-media' : 'data-only';
      downloadBlob(blob, `ahrom-backup-${scope}-${suffix}-${date}.zip`);
      toast({ title: 'بکاپ آماده دانلود شد', description: `حجم: ${formatBytes(blob.size)}` });
    } catch (e: any) {
      toast({ title: 'خطا در ساخت بکاپ', description: e?.message || 'خطای نامشخص', variant: 'destructive' });
    } finally {
      setExporting(false);
      setExportProgress(null);
    }
  }

  async function handleImport(file: File) {
    setImporting(true);
    setImportProgress({ phase: 'reading', message: 'شروع...' });
    try {
      const m = await importBackup(file, setImportProgress);
      setMeta(m);
      await refreshQuota();
      toast({
        title: 'بکاپ بارگذاری شد',
        description: `${m.totalRecords.toLocaleString('fa-IR')} رکورد و ${m.totalMedia.toLocaleString('fa-IR')} فایل رسانه`,
      });
    } catch (e: any) {
      toast({ title: 'خطا در بارگذاری بکاپ', description: e?.message || 'خطای نامشخص', variant: 'destructive' });
    } finally {
      setImporting(false);
      setImportProgress(null);
    }
  }

  async function handleClear() {
    if (!confirm('داده‌های بکاپ ذخیره‌شده در این مرورگر حذف شود؟')) return;
    await clearAll();
    setMeta(null);
    await refreshQuota();
    toast({ title: 'پاک شد' });
  }

  async function ensureServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if (!('serviceWorker' in navigator)) return null;

    // در حالت پیش‌نمایش Lovable سرویس‌ورکر عمداً غیرفعال است
    const host = window.location.hostname;
    const inIframe = (() => { try { return window.self !== window.top; } catch { return true; } })();
    const isPreview = host.includes('lovableproject.com') || (host.includes('lovable.app') && host.includes('id-preview--'));
    if (inIframe || isPreview) return null;

    try {
      let reg = await navigator.serviceWorker.getRegistration('/');
      if (!reg) {
        // اگر هنوز ثبت نشده، همین‌جا ثبتش کن
        reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      }
      // منتظر بمان تا SW فعال شود (با تایم‌اوت ۱۰ ثانیه)
      const ready = navigator.serviceWorker.ready;
      const timeout = new Promise<null>((r) => setTimeout(() => r(null), 10000));
      const active = await Promise.race([ready, timeout]);
      return (active as ServiceWorkerRegistration) || reg || null;
    } catch (e) {
      console.warn('[SW] ensure failed', e);
      return null;
    }
  }

  async function handlePrecache() {
    if (!online) {
      toast({ title: 'اتصال اینترنت لازم است', description: 'برای نصب آفلاین باید آنلاین باشید', variant: 'destructive' });
      return;
    }
    const reg = await ensureServiceWorker();
    if (!reg) {
      const host = window.location.hostname;
      const inIframe = (() => { try { return window.self !== window.top; } catch { return true; } })();
      const isPreview = inIframe || host.includes('lovableproject.com') || (host.includes('lovable.app') && host.includes('id-preview--'));
      toast({
        title: 'Service Worker در دسترس نیست',
        description: isPreview
          ? 'نصب آفلاین در حالت پیش‌نمایش Lovable ممکن نیست. لطفاً روی دامنهٔ اصلی (ahrom.ir) این کار را انجام دهید.'
          : 'مرورگر شما از Service Worker پشتیبانی نمی‌کند یا در حالت خصوصی/ناشناس هستید.',
        variant: 'destructive',
      });
      return;
    }
    setPrecaching(true);
    setPrecacheProgress({ current: 0, total: 0, failed: 0, message: 'شروع...' });
    try {
      const r = await precacheAppAssets(setPrecacheProgress);
      // رسانه‌های ارجاع‌شده در رکوردهای بکاپ را از Storage دانلود و داخل IndexedDB ذخیره کن
      const m = await hydrateBackupMedia(setPrecacheProgress);
      const mediaCount = await countMedia();
      if (meta && mediaCount !== meta.totalMedia) {
        const nextMeta = { ...meta, totalMedia: mediaCount };
        await saveMeta(nextMeta);
        setMeta(nextMeta);
      }
      // پیش‌کش تایل‌های نقشه ایران — بعد از اپ‌شل تا نقشه در آفلاین باز شود
      const t = await precacheMapTiles(setPrecacheProgress);
      await refreshQuota();
      const totalFailed = r.failed + m.failed + t.failed;
      toast({
        title: 'نصب آفلاین انجام شد',
        description: `${r.loaded.toLocaleString('fa-IR')} فایل برنامه + ${m.loaded.toLocaleString('fa-IR')} رسانه + ${t.loaded.toLocaleString('fa-IR')} تایل نقشه ذخیره شد${totalFailed ? ` • ${totalFailed.toLocaleString('fa-IR')} ناموفق` : ''}`,
      });
    } catch (e: any) {
      toast({ title: 'خطا در نصب آفلاین', description: e?.message || 'خطای نامشخص', variant: 'destructive' });
    } finally {
      setPrecaching(false);
      setPrecacheProgress(null);
    }
  }

  const progress = exportProgress || importProgress;
  const busy = exporting || importing || precaching;

  return (
    <Card className="w-full" dir="rtl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HardDrive className="h-5 w-5" />
          {title || (scope === 'full' ? 'بکاپ کامل دیتابیس' : 'بکاپ و حالت آفلاین')}
        </CardTitle>
        <CardDescription>
          {description ||
            'یک فایل پشتیبان از همه داده‌ها و رسانه‌ها بسازید تا در صورت قطع اینترنت بتوانید آن‌ها را به‌صورت آفلاین مشاهده کنید.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 text-sm">
          {online ? (
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <Wifi className="h-4 w-4" /> آنلاین
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <WifiOff className="h-4 w-4" /> آفلاین
            </span>
          )}
        </div>

        {meta && (
          <Alert>
            <Database className="h-4 w-4" />
            <AlertDescription className="space-y-1">
              <div>
                <strong>بکاپ ذخیره‌شده در این مرورگر:</strong>
              </div>
              <div className="text-sm text-muted-foreground">
                ساخته‌شده: {formatDate(meta.createdAt)} • وارد‌شده: {formatDate(meta.importedAt)}
              </div>
              <div className="text-sm">
                {meta.totalRecords.toLocaleString('fa-IR')} رکورد • {meta.totalMedia.toLocaleString('fa-IR')} فایل رسانه •
                نوع: {meta.scope === 'full' ? 'کامل' : 'فقط داده‌های شما'}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {quota && quota.supported && quota.quota > 0 && (
          <Alert>
            <HardDrive className="h-4 w-4" />
            <AlertDescription className="space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap text-sm">
                <div>
                  <strong>فضای ذخیره‌سازی مرورگر</strong>
                </div>
                <button
                  type="button"
                  onClick={refreshQuota}
                  disabled={refreshingQuota}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 disabled:opacity-60 disabled:no-underline"
                >
                  <RefreshCw className={`h-3 w-3 ${refreshingQuota ? 'animate-spin' : ''}`} />
                  {refreshingQuota ? 'در حال به‌روزرسانی...' : 'به‌روزرسانی'}
                </button>
              </div>
              <Progress value={Math.min(100, (quota.usage / quota.quota) * 100)} />
              <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                <span>
                  استفاده‌شده: <strong className="text-foreground">{formatBytes(quota.usage)}</strong>
                </span>
                <span>
                  کل ظرفیت: <strong className="text-foreground">{formatBytes(quota.quota)}</strong>
                </span>
                <span>
                  فضای آزاد: <strong className="text-foreground">{formatBytes(Math.max(0, quota.quota - quota.usage))}</strong>
                </span>
                <span>
                  ({((quota.usage / quota.quota) * 100).toFixed(1).replace('.', '٫')}٪ پر شده)
                </span>
              </div>
              {quota.usage / quota.quota > 0.85 && (
                <div className="text-xs text-destructive">
                  ⚠️ فضای مرورگر رو به اتمام است. برای بارگذاری بکاپ جدید، ابتدا نسخهٔ قبلی را پاک کنید.
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}



        {pending.count > 0 && (
          <Alert>
            <ListChecks className="h-4 w-4" />
            <AlertDescription className="space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <strong>{pending.count.toLocaleString('fa-IR')}</strong> تغییر آفلاین در صف همگام‌سازی
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!online || pending.syncing}
                  onClick={async () => {
                    const r = await pending.sync();
                    toast({
                      title: 'همگام‌سازی انجام شد',
                      description: `${r.succeeded} موفق • ${r.failed} ناموفق از ${r.attempted}`,
                      variant: r.failed > 0 ? 'destructive' : 'default',
                    });
                  }}
                >
                  <RefreshCw className={`ml-2 h-4 w-4 ${pending.syncing ? 'animate-spin' : ''}`} />
                  {pending.syncing ? 'در حال همگام‌سازی...' : 'همگام‌سازی الان'}
                </Button>
              </div>
              {pending.items.some((i) => i.status === 'failed') && (
                <div className="text-xs text-destructive">
                  برخی تغییرات با خطا مواجه شده‌اند. هنگام اتصال مجدد دوباره تلاش می‌شود.
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        {progress && (
          <div className="space-y-2">
            <div className="text-sm">{progress.message}</div>
            {(() => {
              const bytes = (progress as any).bytes as number | undefined;
              const totalBytes = (progress as any).totalBytes as number | undefined;
              if (typeof bytes === 'number' && bytes > 0) {
                return (
                  <div className="text-xs text-muted-foreground">
                    حجم دانلود‌شده تا کنون: {formatBytes(bytes)}
                    {typeof totalBytes === 'number' && totalBytes > 0 ? ` از ${formatBytes(totalBytes)}` : ''}
                  </div>
                );
              }
              return null;
            })()}
            {progress.total ? (
              <Progress value={(progress.current! / progress.total) * 100} />
            ) : (
              <Progress value={undefined as any} className="animate-pulse" />
            )}
          </div>
        )}

        {precacheProgress && (
          <div className="space-y-2">
            <div className="text-sm">{precacheProgress.message}</div>
            {typeof precacheProgress.bytes === 'number' && precacheProgress.bytes > 0 && (
              <div className="text-xs text-muted-foreground">
                حجم رسانه‌های ذخیره‌شده: {formatBytes(precacheProgress.bytes)}
              </div>
            )}
            {precacheProgress.total > 0 && (
              <Progress value={(precacheProgress.current / precacheProgress.total) * 100} />
            )}
          </div>
        )}

        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <Checkbox
            checked={includeMedia}
            onCheckedChange={(v) => setIncludeMedia(v === true)}
            disabled={busy}
          />
          <ImageIcon className="h-4 w-4 text-muted-foreground" />
          <span>عکس‌ها و فیلم‌ها هم در فایل بکاپ گنجانده شود</span>
        </label>

        <div className="flex flex-wrap gap-2">
          <Button onClick={handleExport} disabled={busy || !online}>
            <Download className="ml-2 h-4 w-4" />
            دانلود بکاپ {includeMedia ? '(داده + رسانه)' : '(فقط داده)'}
          </Button>
          <Button
            variant="secondary"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
          >
            <Upload className="ml-2 h-4 w-4" />
            بارگذاری بکاپ
          </Button>
          {meta && (
            <Button
              variant="default"
              onClick={handlePrecache}
              disabled={busy || !online}
              title="بارگیری همهٔ صفحات و فایل‌های برنامه برای استفاده در حالت آفلاین"
            >
              <PackageCheck className="ml-2 h-4 w-4" />
              {precaching ? 'در حال نصب...' : 'نصب برای استفاده آفلاین'}
            </Button>
          )}
          {meta && (
            <Button variant="destructive" onClick={handleClear} disabled={busy}>
              <Trash2 className="ml-2 h-4 w-4" />
              پاک کردن
            </Button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".ahrombackup,.zip,application/zip"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImport(f);
              e.target.value = '';
            }}
          />
        </div>

        <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
          <p>
            <strong>دانلود:</strong> به‌صورت پیش‌فرض فقط داده‌های متنی (جدول‌ها و رکوردها) داخل فایل بکاپ ذخیره می‌شوند
            تا حالت آفلاین سبک و سریع باقی بماند. اگر تیک «گنجاندن عکس‌ها و فیلم‌ها» را بزنید، فایل‌های رسانه‌ای هم
            دانلود و در ZIP قرار می‌گیرند (حجم فایل بزرگ می‌شود).
          </p>
          <p>
            <strong>بارگذاری:</strong> داده‌های بکاپ داخل مرورگر این دستگاه ذخیره می‌شوند. در حالت آفلاین، صفحاتی که
            از کش پشتیبانی می‌کنند کار می‌کنند. عکس‌ها و فیلم‌ها در حالت آفلاین <em>نمایش داده نمی‌شوند</em> مگر این‌که
            بکاپ شامل رسانه باشد.
          </p>
          <p>
            <strong>نصب برای استفاده آفلاین:</strong> پس از بارگذاری بکاپ، با زدن این دکمه همهٔ صفحات و فایل‌های
            برنامه (JS/CSS)، رسانه‌های ارجاع‌شده در رکوردهای بکاپ، و تایل‌های نقشه یک‌بار دانلود و در مرورگر ذخیره می‌شوند تا بتوانید بدون اینترنت همهٔ ماژول‌ها را باز کنید.
            این عملیات فقط در سایت اصلی (نه پیش‌نمایش Lovable) و پس از فعال شدن Service Worker کار می‌کند.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
