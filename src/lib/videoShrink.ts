// کاهش خودکار حجم فیلم برای ارسال در بله
// مرحله ۱: کاهش کیفیت (رزولوشن و نرخ بیت) و بررسی مجدد حجم
// مرحله ۲: اگر باز هم حجم زیاد بود، از انتهای فیلم کم می‌شود تا نزدیک حد مجاز برسد

export const BALE_MAX_BYTES = 44 * 1024 * 1024;

export interface ShrinkResult {
  blob: Blob;
  note: string;
  trimmedSeconds: number;
  durationUsed: number;
}

type ProgressFn = (info: { stage: string; percent: number }) => void;

const QUALITY_STEPS = [
  { height: 720, crf: 30, audio: '96k' },
  { height: 540, crf: 33, audio: '72k' },
  { height: 360, crf: 36, audio: '56k' },
  { height: 288, crf: 38, audio: '48k' },
];

let ffmpegPromise: Promise<any> | null = null;

const loadFFmpeg = async (onProgress?: ProgressFn) => {
  if (ffmpegPromise) return ffmpegPromise;
  ffmpegPromise = (async () => {
    const { FFmpeg } = await import('@ffmpeg/ffmpeg');
    const [{ default: coreJsUrlRaw }, { default: coreWasmUrlRaw }] = await Promise.all([
      import('@ffmpeg/core?url'),
      import('@ffmpeg/core/wasm?url'),
    ]);
    const coreURL = new URL(coreJsUrlRaw, window.location.origin).toString();
    const wasmURL = new URL(coreWasmUrlRaw, window.location.origin).toString();
    const ffmpeg = new FFmpeg();
    ffmpeg.on('progress', ({ progress }: { progress: number }) =>
      onProgress?.({ stage: 'در حال پردازش فیلم', percent: Math.min(99, Math.round(progress * 100)) }),
    );
    await ffmpeg.load({ coreURL, wasmURL });
    return ffmpeg;
  })();
  return ffmpegPromise;
};

export const readVideoDuration = (blob: Blob) =>
  new Promise<number>((resolve) => {
    const url = URL.createObjectURL(blob);
    const el = document.createElement('video');
    el.preload = 'metadata';
    el.onloadedmetadata = () => {
      const d = Number.isFinite(el.duration) ? el.duration : 0;
      URL.revokeObjectURL(url);
      resolve(d);
    };
    el.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(0);
    };
    el.src = url;
  });

/**
 * فیلم را تا زیر حد مجاز کوچک می‌کند: اول کیفیت، سپس کوتاه‌کردن از انتها.
 */
export const shrinkVideoForBale = async (
  source: Blob,
  onProgress?: ProgressFn,
  maxBytes: number = BALE_MAX_BYTES,
): Promise<ShrinkResult> => {
  if (source.size <= maxBytes) {
    return { blob: source, note: 'حجم فیلم در حد مجاز بود', trimmedSeconds: 0, durationUsed: 0 };
  }

  onProgress?.({ stage: 'بارگذاری ابزار پردازش فیلم', percent: 2 });
  const ffmpeg = await loadFFmpeg(onProgress);
  const { fetchFile } = await import('@ffmpeg/util');

  const duration = await readVideoDuration(source);
  await ffmpeg.writeFile('shrink-in.mp4', await fetchFile(source));

  const run = async (height: number, crf: number, audio: string, seconds?: number) => {
    const args = ['-i', 'shrink-in.mp4'];
    if (seconds && seconds > 1) args.push('-t', String(Math.floor(seconds)));
    args.push(
      '-vf',
      `scale=-2:${height}`,
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      String(crf),
      '-c:a',
      'aac',
      '-b:a',
      audio,
      '-movflags',
      '+faststart',
      'shrink-out.mp4',
    );
    await ffmpeg.exec(args);
    const data = await ffmpeg.readFile('shrink-out.mp4');
    const blob = new Blob([(data as Uint8Array).buffer as ArrayBuffer], { type: 'video/mp4' });
    try {
      await ffmpeg.deleteFile('shrink-out.mp4');
    } catch {
      /* نادیده */
    }
    return blob;
  };

  let best: Blob | null = null;
  let step = QUALITY_STEPS[QUALITY_STEPS.length - 1];

  // مرحله ۱: کاهش تدریجی کیفیت و بررسی مجدد حجم
  for (let i = 0; i < QUALITY_STEPS.length; i++) {
    step = QUALITY_STEPS[i];
    onProgress?.({ stage: `کاهش کیفیت فیلم (مرحله ${i + 1})`, percent: 5 });
    best = await run(step.height, step.crf, step.audio);
    if (best.size <= maxBytes) {
      await ffmpeg.deleteFile('shrink-in.mp4').catch(() => undefined);
      return {
        blob: best,
        note: `کیفیت فیلم تا ${step.height}p کاهش یافت`,
        trimmedSeconds: 0,
        durationUsed: duration,
      };
    }
  }

  // مرحله ۲: کوتاه‌کردن از انتهای فیلم تا نزدیک حد مجاز
  let usedDuration = duration;
  if (best && duration > 2) {
    for (let attempt = 0; attempt < 5 && best.size > maxBytes; attempt++) {
      const ratio = (maxBytes * 0.94) / best.size;
      usedDuration = Math.max(3, Math.floor(usedDuration * ratio));
      onProgress?.({ stage: `کوتاه‌کردن انتهای فیلم تا ${usedDuration} ثانیه`, percent: 10 });
      best = await run(step.height, step.crf, step.audio, usedDuration);
    }
  }

  await ffmpeg.deleteFile('shrink-in.mp4').catch(() => undefined);

  if (!best) throw new Error('کاهش حجم فیلم انجام نشد');
  if (best.size > maxBytes) throw new Error('حجم فیلم حتی پس از کاهش کیفیت و کوتاه‌کردن کم نشد');

  const trimmed = Math.max(0, Math.round(duration - usedDuration));
  return {
    blob: best,
    note:
      trimmed > 0
        ? `کیفیت تا ${step.height}p کم شد و ${trimmed} ثانیه از انتهای فیلم کوتاه شد`
        : `کیفیت فیلم تا ${step.height}p کاهش یافت`,
    trimmedSeconds: trimmed,
    durationUsed: usedDuration,
  };
};
