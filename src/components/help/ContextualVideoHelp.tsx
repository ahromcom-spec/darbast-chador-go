import { useEffect, useState } from 'react';
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

const VideoBody = ({ video }: { video: HelpVideo }) => {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    resolveHelpVideoUrl(video).then((resolved) => {
      if (!cancelled) setUrl(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [video]);

  return (
    <div className="space-y-3">
      <div className="relative w-full overflow-hidden rounded-lg bg-black aspect-video">
        {url ? (
          <video
            src={url}
            poster={video.poster_url || undefined}
            controls
            playsInline
            preload="metadata"
            className="w-full h-full object-contain"
          >
            مرورگر شما از پخش ویدیو پشتیبانی نمی‌کند
          </video>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-7 w-7 text-white animate-spin" />
          </div>
        )}
      </div>
      {video.description && (
        <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
          {video.description}
        </p>
      )}
    </div>
  );
};

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
