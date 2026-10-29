import { ORDER_VIDEO_MAX_SECONDS, orderVideoEncodingArgs } from './orderVideoPolicy';
import coreURL from '@ffmpeg/core?url';
import wasmURL from '@ffmpeg/core/wasm?url';
import classWorkerURL from '@ffmpeg/ffmpeg/worker?worker&url';

export type VideoPreparationProgress = (stage: string, percent: number) => void;
let queue: Promise<unknown> = Promise.resolve();
const preparedFiles = new WeakSet<File>();

/** Serialize encodes to bound memory on phones. Never fall back to uploading the original. */
export function prepareOrderVideo(file: File, onProgress?: VideoPreparationProgress): Promise<File> {
  if (preparedFiles.has(file)) return Promise.resolve(file);
  const job = queue.then(async () => {
    onProgress?.('بارگذاری ابزار کاهش حجم فیلم...', 0);
    const { FFmpeg } = await import('@ffmpeg/ffmpeg');
    const ffmpeg = new FFmpeg();
    const input = `input.${file.name.split('.').pop()?.replace(/[^a-z0-9]/gi, '') || 'mp4'}`;
    try {
      await ffmpeg.load({ coreURL, wasmURL, classWorkerURL });
      onProgress?.('تبدیل دقیقهٔ اول فیلم به کیفیت ۴۸۰...', 5);
      ffmpeg.on('progress', ({ time }) => {
        onProgress?.('تبدیل دقیقهٔ اول فیلم به کیفیت ۴۸۰...', Math.min(99, 5 + Math.round(time / 1_000_000 / ORDER_VIDEO_MAX_SECONDS * 94)));
      });
      await ffmpeg.writeFile(input, new Uint8Array(await file.arrayBuffer()));
      const code = await ffmpeg.exec(orderVideoEncodingArgs(input, 'output.mp4'), 600_000);
      if (code !== 0) throw new Error('تبدیل فیلم انجام نشد؛ فایل دیگری انتخاب کنید.');
      const data = await ffmpeg.readFile('output.mp4');
      if (!(data instanceof Uint8Array) || data.byteLength === 0) throw new Error('فیلم تبدیل‌شده خالی است.');
      const converted = new File([new Uint8Array(data).buffer], `${file.name.replace(/\.[^.]+$/, '')}-480p.mp4`, { type: 'video/mp4', lastModified: file.lastModified });
      preparedFiles.add(converted);
      onProgress?.('فیلم آمادهٔ ذخیره است', 100);
      return converted;
    } catch (error) {
      throw new Error(`آماده‌سازی فیلم انجام نشد و اصل فیلم ذخیره نشد: ${error instanceof Error ? error.message : 'دوباره تلاش کنید'}`);
    } finally {
      ffmpeg.terminate();
    }
  });
  queue = job.catch(() => undefined);
  return job;
}