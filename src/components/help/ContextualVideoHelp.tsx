import { memo, useEffect, useRef, useState } from 'react';
import { trackVideoDownload } from '@/lib/mediaTransfers';
import { HelpCircle, PlayCircle, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useHelpVideo, resolveHelpVideoUrl, type HelpVideo } from '@/hooks/useHelpVideos';

interface ContextualVideoHelpProps {
  /** Unique context identifier, e.g. "order-form-scaffolding" or "profile-invoice" */
  contextKey: string;
  /** modal (default): small button opening a dialog. inline: collapsible accordion. */
  variant?: 'modal' | 'inline';
  /** icon: compact icon-only button. */
  size?: 'sm' | 'icon';
  label?: string;
  className?: string;
}

export const VideoBody = memo(({ video }: { video: HelpVideo }) => {
  const [url, setUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const bufferLabelRef = useRef<HTMLDivElement | null>(null);
  const videoId = video.id;
  const videoTitle = video.title;
  const storagePath = video.storage_path;
  const videoUrl = video.video_url;

  useEffect(() => {
    let cancelled = false;
    resolveHelpVideoUrl({ storage_path: storagePath, video_url: videoUrl } as HelpVideo).then((resolved) => {
      if (!cancelled) setUrl(resolved);
    });
    return () => {
      cancelled = true;
    };
    // فقط با تغییر خودِ فیلم آدرس دوباره ساخته می‌شود تا پخش قطع نشود
  }, [videoId, storagePath, videoUrl]);

  // نمایش میزان دریافت (دانلود) ویدیو — با به‌روزرسانی کم تا پخش روی موبایل کند نشود
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !url) return;
    const stop = trackVideoDownload(el, `دریافت ویدیو: ${videoTitle}`);
    let last = 0;
    const onProgress = () => {
      if (!el.duration || !isFinite(el.duration) || el.buffered.length === 0) return;
      const percent = Math.round((el.buffered.end(el.buffered.length - 1) / el.duration) * 100);
      if (percent - last >= 10 || percent >= 100) {
        last = percent;
        if (bufferLabelRef.current) {
          bufferLabelRef.current.textContent = `دریافت ویدیو: ${percent}%`;
          bufferLabelRef.current.hidden = percent >= 100;
        }
      }
    };
    el.addEventListener('progress', onProgress);
    return () => {
      el.removeEventListener('progress', onProgress);
      stop();
    };
  }, [url, videoTitle]);

  return (
    <div className="space-y-3">
      <div className="relative w-full overflow-hidden rounded-lg bg-black aspect-video">
        {url ? (
          <>
            <video
              ref={videoRef}
              src={url}
              poster={video.poster_url || undefined}
              controls
              playsInline
              preload="auto"
              className="w-full h-full object-contain"
            >
              مرورگر شما از پخش ویدیو پشتیبانی نمی‌کند
            </video>
            <div
              ref={bufferLabelRef}
              hidden
              className="absolute top-2 left-2 rounded-md bg-black/60 px-2 py-0.5 text-[11px] text-white"
            />
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-7 w-7 text-white animate-spin" />
          </div>
        )}
      </div>
      <h3 className="text-center text-sm font-semibold text-foreground" dir="rtl">
        {video.title}
      </h3>
      {video.description && (
        <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
          {video.description}
        </p>
      )}
    </div>
  );
});

VideoBody.displayName = 'VideoBody';

export const ContextualVideoHelp = ({
  contextKey,
  variant = 'modal',
  size = 'sm',
  label = 'راهنمای ویدیویی',
  className,
}: ContextualVideoHelpProps) => {
  const { video, loading } = useHelpVideo(contextKey);
  const [open, setOpen] = useState(false);

  if (loading || !video) return null;

  if (variant === 'inline') {
    return (
      <div className={cn('rounded-lg border border-border bg-card/50 overflow-hidden', className)} dir="rtl">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 text-right hover:bg-accent/40 transition-colors"
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <PlayCircle className="h-4 w-4 text-primary shrink-0" />
            {video.title || label}
          </span>
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {open && (
          <div className="p-3 pt-0">
            <VideoBody video={video} />
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {size === 'icon' ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setOpen(true)}
          aria-label={video.title || label}
          title={video.title || label}
          className={cn('h-8 w-8 text-primary shrink-0', className)}
        >
          <HelpCircle className="h-5 w-5" />
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
          className={cn('gap-1.5 h-8 text-xs border-primary/40 text-primary hover:bg-primary/10 shrink-0', className)}
        >
          <PlayCircle className="h-4 w-4" />
          {label}
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle className="flex items-center gap-2 text-base">
              <PlayCircle className="h-5 w-5 text-primary" />
              {video.title || label}
            </DialogTitle>
            <DialogDescription className="sr-only">راهنمای ویدیویی این بخش</DialogDescription>
          </DialogHeader>
          <VideoBody video={video} />
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ContextualVideoHelp;
