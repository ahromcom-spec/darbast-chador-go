export const ORDER_VIDEO_MAX_SECONDS = 60;
export const ORDER_VIDEO_SD_SIZE = 480;
export const ORDER_VIDEO_NOTICE = 'فقط یک دقیقهٔ اول هر فیلم با کیفیت SD / 480p ذخیره می‌شود؛ ادامهٔ فیلم ذخیره نمی‌شود.';

/** SD bounds preserve landscape/portrait shape and never upscale smaller videos. */
export const orderVideoEncodingArgs = (input: string, output: string) => [
  '-y', '-i', input, '-t', String(ORDER_VIDEO_MAX_SECONDS),
  '-map', '0:v:0', '-map', '0:a:0?',
  '-vf', "scale=w='if(gte(iw,ih),min(iw,854),min(iw,480))':h='if(gte(iw,ih),min(ih,480),min(ih,854))':force_original_aspect_ratio=decrease:force_divisible_by=2,setsar=1",
  '-r', '24', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28',
  '-pix_fmt', 'yuv420p', '-maxrate', '1200k', '-bufsize', '2400k',
  '-c:a', 'aac', '-b:a', '64k', '-ac', '1', '-movflags', '+faststart', output,
];