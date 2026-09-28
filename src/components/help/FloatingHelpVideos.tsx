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

/** محل ذخیره‌شده هر کاربر روی همان دستگاه (بدون دسترسی مدیریتی) */
const localPosKey = (id: string, isMobile: boolean) =>
  `help-video-pos-${isMobile ? 'mobile' : 'desktop'}-${id}`;

const readLocalPos = (id: string, isMobile: boolean) => {
  try {
    const raw = localStorage.getItem(localPosKey(id, isMobile));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') return parsed as { x: number; y: number };
  } catch {
    /* ignore */
  }
  return null;
};

const writeLocalPos = (id: string, isMobile: boolean, pos: { x: number; y: number }) => {
  try {
    localStorage.setItem(localPosKey(id, isMobile), JSON.stringify(pos));
  } catch {
    /* ignore */
  }
};

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
  /** جابه‌جایی با نگه‌داشتن (برای همه کاربران) */
  const [holdDragging, setHoldDragging] = useState(false);
  const initial = placementFor(video, isMobile);
  const [pos, setPos] = useState(() => readLocalPos(video.id, isMobile) ?? { x: initial.x, y: initial.y });
  const [size, setSize] = useState(initial.size);
  const draggingRef = useRef(false);
  const movedRef = useRef(false);
  const holdTimerRef = useRef<number | null>(null);
  const holdWasRef = useRef(false);
  const downPointRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const p = placementFor(video, isMobile);
    const local = readLocalPos(video.id, isMobile);
    if (local) {
      setPos(local);
    } else {
      setPos({ x: p.x, y: p.y });
    }
    setSize(p.size);
  }, [
    video.id,
    video.pos_x,
    video.pos_y,
    video.box_size,
    video.pos_x_mobile,
    video.pos_y_mobile,
    video.box_size_mobile,
    isMobile,
  ]);

  // پاک‌سازی زمان‌سنج نگه‌داشتن هنگامUnmount
  useEffect(
    () => () => {
      if (holdTimerRef.current !== null) window.clearTimeout(holdTimerRef.current);
    },
    []
  );

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


  /** ذخیره محل پس از رهاکردن: مدیران روی پایگاه داده (سراسری)، سایر کاربران روی همین دستگاه */
  const persistPlacementRef = useRef<() => void>(() => {});
  persistPlacementRef.current = () => {
    if (canManage) {
      save();
    } else {
      writeLocalPos(video.id, isMobile, { x: pos.x, y: pos.y });
      toast({ title: 'محل آیکون فیلم راهنما ذخیره شد' });
    }
  };

  useEffect(() => {
    if (!editing && !holdDragging) return;
    const onMove = (e: PointerEvent) => {
      if (!draggingRef.current) return;
      movedRef.current = true;
      e.preventDefault();
      applyPointer(e.clientX, e.clientY);
    };
    const onUp = () => {
      if (draggingRef.current && holdWasRef.current) {
        persistPlacementRef.current();
      }
      draggingRef.current = false;
      holdWasRef.current = false;
      setHoldDragging(false);
    };
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [editing, holdDragging, applyPointer]);

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

        {/* شیشه‌ای ۶۰٪: آیکون و نوشته روی هوا، بدون هیچ کادر پشت */}
        <div
          className={cn(
            'relative flex flex-col items-center gap-1 transition-opacity duration-300',
            editing ? 'opacity-100' : 'opacity-60'
          )}
        >
          <button
            type="button"
            title={video.title}
            aria-label={video.title}
            onPointerDown={(e) => {
              (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
              downPointRef.current = { x: e.clientX, y: e.clientY };
              movedRef.current = false;
              holdWasRef.current = false;
              if (editing) {
                draggingRef.current = true;
                return;
              }
              // نگه‌داشتن انگشت/موس: آیکون قابل جابه‌جایی می‌شود
              if (holdTimerRef.current !== null) window.clearTimeout(holdTimerRef.current);
              holdTimerRef.current = window.setTimeout(() => {
                holdTimerRef.current = null;
                draggingRef.current = true;
                holdWasRef.current = true;
                setHoldDragging(true);
              }, 450);
            }}
            onPointerMove={(e) => {
              // اگر پیش از پایان نگه‌داشتن حرکت کرد، جابه‌جایی آغاز نشود
              if (!draggingRef.current && holdTimerRef.current !== null && downPointRef.current) {
                const dx = e.clientX - downPointRef.current.x;
                const dy = e.clientY - downPointRef.current.y;
                if (Math.abs(dx) + Math.abs(dy) > 10) {
                  window.clearTimeout(holdTimerRef.current);
                  holdTimerRef.current = null;
                }
              }
            }}
            onPointerUp={() => {
              if (holdTimerRef.current !== null) {
                window.clearTimeout(holdTimerRef.current);
                holdTimerRef.current = null;
              }
            }}
            onPointerCancel={() => {
              if (holdTimerRef.current !== null) {
                window.clearTimeout(holdTimerRef.current);
                holdTimerRef.current = null;
              }
              draggingRef.current = false;
              holdWasRef.current = false;
              setHoldDragging(false);
            }}
            onContextMenu={(e) => {
              // جلوگیری از منوی لمس هنگام نگه‌داشتن روی موبایل
              if (holdDragging) e.preventDefault();
            }}
            onClick={() => {
              if (editing || movedRef.current) return;
              setOpen(true);
            }}
            className={cn(
              'flex items-center justify-center rounded-lg bg-transparent transition-transform hover:scale-105',
              (editing || holdDragging) && 'cursor-move ring-4 ring-red-500/50',
              editing && 'animate-pulse'
            )}
            style={{
              width: size,
              height: Math.round(size * 0.85),
              touchAction: 'none',
              userSelect: 'none',
              WebkitTouchCallout: 'none',
            } as React.CSSProperties}
          >
            {editing ? (
              <Move className="h-1/2 w-1/2 text-red-600" />
            ) : (
              <svg
                viewBox="0 0 64 56"
                className="h-full w-full"
                fill="none"
                aria-hidden="true"
                style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.35))' }}
              >
                {/* آنتن تلویزیون */}
                <path d="M24 13 L13 2" stroke="#dc2626" strokeWidth="4" strokeLinecap="round" />
                <path d="M40 13 L51 2" stroke="#dc2626" strokeWidth="4" strokeLinecap="round" />
                {/* قاب قرمز تلویزیون */}
                <rect x="6" y="13" width="52" height="36" rx="7" fill="#dc2626" />
                {/* صفحه مشکی داخل تلویزیون */}
                <rect x="11" y="18" width="42" height="26" rx="4" fill="#0a0a0a" />
                {/* مثلث پخش */}
                <path d="M28 23 L42 31 L28 39 Z" fill="#ffffff" />
              </svg>
            )}
          </button>

          {!editing && (
            <span
              className="max-w-40 text-center text-xs font-medium leading-5 text-foreground"
              dir="rtl"
              style={{ textShadow: '0 1px 2px rgba(0,0,0,0.45), 0 0 8px rgba(255,255,255,0.35)' }}
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
