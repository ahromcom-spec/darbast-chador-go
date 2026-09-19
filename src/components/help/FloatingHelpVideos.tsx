import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { Move, PlayCircle, Check, Minus, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  useFloatingHelpVideos,
  saveHelpVideoPlacement,
  type HelpVideo,
} from '@/hooks/useHelpVideos';
import { VideoBody } from '@/components/help/ContextualVideoHelp';
import { useCEORole } from '@/hooks/useCEORole';
import { useAdminRole } from '@/hooks/useAdminRole';
import { useGeneralManagerRole } from '@/hooks/useGeneralManagerRole';

const clamp = (n: number) => Math.min(97, Math.max(0.5, n));

interface BubbleProps {
  video: HelpVideo;
  canManage: boolean;
}

/** محل و اندازه ذخیره‌شده برای دستگاه فعلی (موبایل مقادیر خودش، در غیر این صورت مقادیر ویندوز) */
const placementFor = (video: HelpVideo, isMobile: boolean) =>
  isMobile
    ? {
        x: video.pos_x_mobile ?? video.pos_x ?? 90,
        y: video.pos_y_mobile ?? video.pos_y ?? 80,
        size: video.box_size_mobile ?? video.box_size ?? 56,
      }
    : { x: video.pos_x ?? 90, y: video.pos_y ?? 80, size: video.box_size || 56 };

const HelpBubble = ({ video, canManage }: BubbleProps) => {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const initial = placementFor(video, isMobile);
  const [pos, setPos] = useState({ x: initial.x, y: initial.y });
  const [size, setSize] = useState(initial.size);
  const draggingRef = useRef(false);
  const movedRef = useRef(false);

  useEffect(() => {
    const p = placementFor(video, isMobile);
    setPos({ x: p.x, y: p.y });
    setSize(p.size);
  }, [
    video.pos_x,
    video.pos_y,
    video.box_size,
    video.pos_x_mobile,
    video.pos_y_mobile,
    video.box_size_mobile,
    isMobile,
  ]);

  /** اندازه کل صفحه (نه فقط پنجره) تا کادر به خودِ صفحه بچسبد و با اسکرول حرکت کند */
  const [docSize, setDocSize] = useState({ w: 1, h: 1 });
  useEffect(() => {
    // هنگام پخش فیلم اندازه‌گیری متوقف می‌شود تا صفحه دوباره‌سازی نشود و پخش مکث نکند
    if (open) return;
    const measure = () =>
      setDocSize((prev) => {
        const w = Math.max(document.documentElement.scrollWidth, window.innerWidth);
        const h = Math.max(document.documentElement.scrollHeight, window.innerHeight);
        return prev.w === w && prev.h === h ? prev : { w, h };
      });
    measure();
    window.addEventListener('resize', measure);
    const t = window.setInterval(measure, 1500);
    return () => {
      window.removeEventListener('resize', measure);
      window.clearInterval(t);
    };
  }, [open]);

  const applyPointer = useCallback((clientX: number, clientY: number) => {
    const w = Math.max(document.documentElement.scrollWidth, window.innerWidth);
    const h = Math.max(document.documentElement.scrollHeight, window.innerHeight);
    setPos({
      x: clamp(((clientX + window.scrollX) / w) * 100),
      y: clamp(((clientY + window.scrollY) / h) * 100),
    });
  }, []);


  useEffect(() => {
    if (!editing) return;
    const onMove = (e: PointerEvent) => {
      if (!draggingRef.current) return;
      movedRef.current = true;
      e.preventDefault();
      applyPointer(e.clientX, e.clientY);
    };
    const onUp = () => {
      draggingRef.current = false;
    };
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [editing, applyPointer]);

  const save = async () => {
    try {
      await saveHelpVideoPlacement(
        video.id,
        { pos_x: pos.x, pos_y: pos.y, box_size: size },
        isMobile ? 'mobile' : 'desktop'
      );
      setEditing(false);
      toast({
        title: isMobile ? 'محل فیلم راهنما برای موبایل ذخیره شد' : 'محل فیلم راهنما برای ویندوز ذخیره شد',
      });
    } catch (err: any) {
      toast({ title: 'خطا در ذخیره محل فیلم', description: err?.message, variant: 'destructive' });
    }
  };

  /**
   * کادر به نقطه‌ای از خودِ صفحه می‌چسبد (نه به پنجره) و با اسکرول بالا و پایین می‌رود،
   * مثل کره زمین در صفحه نخست.
   */
  const bubble = (
    <>
      <div
        className="absolute"
        style={{
          top: `${(pos.y / 100) * docSize.h}px`,
          left: `${(pos.x / 100) * docSize.w}px`,
          transform: 'translate(-50%, -50%)',
          zIndex: 90,
          zoom: 1,
          touchAction: editing ? 'none' : undefined,
        } as React.CSSProperties}
      >

        <div className="relative flex flex-col items-center gap-1">
          {/* آیکون تلویزیونی با قاب قرمز: حس پخش فیلم مهم */}
          <button
            type="button"
            title={video.title}
            aria-label={video.title}
            onPointerDown={(e) => {
              if (!editing) return;
              draggingRef.current = true;
              movedRef.current = false;
              (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
            }}
            onClick={() => {
              if (editing) return;
              setOpen(true);
            }}
            className={cn(
              'flex items-center justify-center rounded-lg bg-transparent shadow-[0_0_18px_rgba(220,38,38,0.55)] transition-transform hover:scale-105',
              editing && 'cursor-move ring-4 ring-red-500/50 animate-pulse'
            )}
            style={{ width: size, height: Math.round(size * 0.85) }}
          >
            {editing ? (
              <Move className="h-1/2 w-1/2 text-red-600" />
            ) : (
              <svg viewBox="0 0 64 56" className="h-full w-full" fill="none" aria-hidden="true">
                {/* آنتن تلویزیون */}
                <path d="M24 14 L13 3" stroke="#dc2626" strokeWidth="4" strokeLinecap="round" />
                <path d="M40 14 L51 3" stroke="#dc2626" strokeWidth="4" strokeLinecap="round" />
                <path d="M24 14 L13 3" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M40 14 L51 3" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" />
                {/* قاب قرمز تلویزیون */}
                <rect x="2" y="13" width="60" height="41" rx="8" fill="#0f172a" stroke="#dc2626" strokeWidth="5" />
                {/* درخشش داخلی صفحه */}
                <rect x="7" y="18" width="50" height="31" rx="5" fill="#1e293b" />
                {/* مثلث پخش */}
                <path d="M27 25 L43 33.5 L27 42 Z" fill="#ffffff" />
              </svg>
            )}
          </button>

          {!editing && (
            <span
              className="max-w-40 rounded-md border border-border bg-background/95 px-2 py-1 text-center text-xs font-medium leading-5 text-foreground shadow"
              dir="rtl"
            >
              {video.title}
            </span>
          )}

          {canManage && (
            <div className="flex items-center gap-1 rounded-full bg-background/95 border border-border px-1.5 py-0.5 shadow" dir="rtl">
              {editing ? (
                <>
                  <button
                    type="button"
                    onClick={() => setSize((s) => Math.max(36, s - 6))}
                    className="p-0.5 text-muted-foreground hover:text-foreground"
                    title="کوچک‌تر"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSize((s) => Math.min(120, s + 6))}
                    className="p-0.5 text-muted-foreground hover:text-foreground"
                    title="بزرگ‌تر"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={save}
                    className="flex items-center gap-1 rounded-full bg-green-600 px-1.5 py-0.5 text-[10px] text-white"
                  >
                    <Check className="h-3 w-3" />
                    ذخیره
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-1 px-1 text-[10px] text-muted-foreground hover:text-primary"
                  title="جابجایی و تنظیم اندازه"
                >
                  <Move className="h-3 w-3" />
                  جابجایی
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle className="flex items-center gap-2 text-base">
              <PlayCircle className="h-5 w-5 text-primary" />
              {video.title}
            </DialogTitle>
            <DialogDescription className="sr-only">راهنمای ویدیویی این صفحه</DialogDescription>
          </DialogHeader>
          <VideoBody video={video} />
        </DialogContent>
      </Dialog>
    </>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(bubble, document.body);
};

/**
 * راهنماهای ویدیویی شناور: هر راهنما در مختصات دلخواهی که مدیر تعیین کرده روی صفحه قرار می‌گیرد
 * و مدیران می‌توانند همان‌جا آن را با کشیدن جابجا و اندازه‌اش را تنظیم کنند.
 */
export const FloatingHelpVideos = () => {
  const location = useLocation();
  const routeWithQuery = `${location.pathname}${location.search}`;
  const { videos: exactVideos, loading: exactLoading } = useFloatingHelpVideos(routeWithQuery);
  const { videos: pathVideos, loading: pathLoading } = useFloatingHelpVideos(location.pathname);
  const [pagePainted, setPagePainted] = useState(false);

  const { isCEO } = useCEORole();
  const { isAdmin } = useAdminRole();
  const { isGeneralManager } = useGeneralManagerRole();
  const canManage = isCEO || isAdmin || isGeneralManager;

  const videos = useMemo(() => {
    const seen = new Set<string>();
    return [...exactVideos, ...pathVideos].filter((video) => {
      if (seen.has(video.id)) return false;
      seen.add(video.id);
      return true;
    });
  }, [exactVideos, pathVideos]);

  // دو فریم صبر می‌کنیم تا محتوای اصلی صفحه واقعاً روی نمایشگر نقش ببندد.
  // خود این بخش داخل Suspense قرار دارد، پس هنگام پنجره «در حال بارگذاری» اصلاً رندر نمی‌شود.
  useEffect(() => {
    setPagePainted(false);
    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => setPagePainted(true));
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
    };
  }, [routeWithQuery]);

  if (exactLoading || pathLoading || !pagePainted || videos.length === 0) return null;

  return (
    <>
      {videos.map((v) => (
        <HelpBubble key={v.id} video={v} canManage={canManage} />
      ))}
    </>
  );
};

export default FloatingHelpVideos;
