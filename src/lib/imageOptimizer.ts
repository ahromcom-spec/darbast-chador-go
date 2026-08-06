/**
 * بهینه‌سازی حرفه‌ای تصاویر در سمت کلاینت
 * - کاهش ابعاد تا حداکثر اندازه مشخص (پیش‌فرض 1920px)
 * - تبدیل به WebP (در صورت پشتیبانی مرورگر) یا JPEG
 * - کاهش تدریجی کیفیت تا رسیدن به حجم هدف
 * نتیجه: آپلود سریع‌تر، مصرف اینترنت کمتر و نمایش روان‌تر عکس‌ها روی سفارش
 */

export interface CompressOptions {
  maxDimension?: number;
  quality?: number;
  targetBytes?: number;
}

const DEFAULTS: Required<CompressOptions> = {
  maxDimension: 1920,
  quality: 0.82,
  targetBytes: 1.2 * 1024 * 1024, // ~1.2MB
};

let webpSupport: boolean | null = null;

function supportsWebP(): boolean {
  if (webpSupport !== null) return webpSupport;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    webpSupport = canvas.toDataURL('image/webp').startsWith('data:image/webp');
  } catch {
    webpSupport = false;
  }
  return webpSupport;
}

export function isImageFile(file: File): boolean {
  return (
    (file.type?.startsWith('image/') ?? false) ||
    /\.(jpe?g|png|webp|heic|heif|bmp|gif|tiff?)$/i.test(file.name)
  );
}

async function loadBitmap(file: File): Promise<{ width: number; height: number; source: CanvasImageSource; cleanup: () => void }> {
  // createImageBitmap سریع‌ترین مسیر است و در ترد اصلی بلاک نمی‌کند
  if ('createImageBitmap' in window) {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        width: bitmap.width,
        height: bitmap.height,
        source: bitmap,
        cleanup: () => bitmap.close?.(),
      };
    } catch {
      /* سقوط به روش img */
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('cannot decode image'));
      el.src = url;
    });
    return {
      width: img.naturalWidth,
      height: img.naturalHeight,
      source: img,
      cleanup: () => URL.revokeObjectURL(url),
    };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), mime, quality));
}

/**
 * فشرده‌سازی یک تصویر. در صورت هر خطا، فایل اصلی برگردانده می‌شود (آپلود هرگز متوقف نمی‌شود).
 */
export async function compressImage(file: File, options: CompressOptions = {}): Promise<File> {
  if (!isImageFile(file)) return file;
  // GIF متحرک را دست نمی‌زنیم
  if (file.type === 'image/gif') return file;

  const { maxDimension, quality, targetBytes } = { ...DEFAULTS, ...options };

  try {
    const { width, height, source, cleanup } = await loadBitmap(file);
    if (!width || !height) {
      cleanup();
      return file;
    }

    const scale = Math.min(1, maxDimension / Math.max(width, height));
    const targetW = Math.max(1, Math.round(width * scale));
    const targetH = Math.max(1, Math.round(height * scale));

    // اگر عکس هم کوچک است و هم کم‌حجم، نیازی به پردازش نیست
    if (scale === 1 && file.size <= targetBytes && (file.type === 'image/jpeg' || file.type === 'image/webp')) {
      cleanup();
      return file;
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      cleanup();
      return file;
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, targetW, targetH);
    cleanup();

    const mime = supportsWebP() ? 'image/webp' : 'image/jpeg';
    const ext = mime === 'image/webp' ? 'webp' : 'jpg';

    let q = quality;
    let blob = await canvasToBlob(canvas, mime, q);

    // کاهش تدریجی کیفیت تا رسیدن به حجم هدف
    while (blob && blob.size > targetBytes && q > 0.45) {
      q -= 0.12;
      blob = await canvasToBlob(canvas, mime, q);
    }

    if (!blob || blob.size >= file.size) return file;

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'image';
    return new File([blob], `${baseName}.${ext}`, { type: mime, lastModified: Date.now() });
  } catch {
    return file;
  }
}

/**
 * فشرده‌سازی گروهی با محدودیت همزمانی (برای جلوگیری از فریز شدن مرورگر موبایل)
 */
export async function compressImages(
  files: File[],
  options: CompressOptions = {},
  onProgress?: (done: number, total: number) => void
): Promise<File[]> {
  const results: File[] = new Array(files.length);
  const CONCURRENCY = 2;
  let index = 0;
  let done = 0;

  const worker = async () => {
    while (index < files.length) {
      const i = index++;
      results[i] = await compressImage(files[i], options);
      done++;
      onProgress?.(done, files.length);
    }
  };

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, files.length) }, worker));
  return results;
}
