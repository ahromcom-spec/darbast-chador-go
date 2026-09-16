import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Move, PlayCircle, Check, Minus, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
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

const HelpBubble = ({ video, canManage }: BubbleProps) => {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [pos, setPos] = useState({ x: video.pos_x ?? 90, y: video.pos_y ?? 80 });
  const [size, setSize] = useState(video.box_size || 56);
  const draggingRef = useRef(false);
  const movedRef = useRef(false);

  useEffect(() => {
    setPos({ x: video.pos_x ?? 90, y: video.pos_y ?? 80 });
    setSize(video.box_size || 56);
  }, [video.pos_x, video.pos_y, video.box_size]);

  const applyPointer = useCallback((clientX: number, clientY: number) => {
    setPos({
      x: clamp((clientX / window.innerWidth) * 100),
      y: clamp((clientY / window.innerHeight) * 100),
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
      await saveHelpVideoPlacement(video.id, { pos_x: pos.x, pos_y: pos.y, box_size: size });
      setEditing(false);
      toast({ title: 'محل فیلم راهنما ذخیره شد' });
    } catch (err: any) {
      toast({ title: 'خطا در ذخیره محل فیلم', description: err?.message, variant: 'destructive' });
    }
  };

  return (
    <>
      <div
        className="fixed"
        style={{
          top: `${pos.y}%`,
          left: `${pos.x}%`,
          transform: 'translate(-50%, -50%)',
          zIndex: 90,
          touchAction: editing ? 'none' : undefined,
        }}
      >
        <div className="relative flex flex-col items-center gap-1">
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
              'flex items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105',
              editing && 'cursor-move ring-4 ring-primary/30 animate-pulse'
            )}
            style={{ width: size, height: size }}
          >
            {editing ? <Move className="h-1/2 w-1/2" /> : <PlayCircle className="h-1/2 w-1/2" />}
          </button>

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
};

/**
 * راهنماهای ویدیویی شناور: هر راهنما در مختصات دلخواهی که مدیر تعیین کرده روی صفحه قرار می‌گیرد
 * و مدیران می‌توانند همان‌جا آن را با کشیدن جابجا و اندازه‌اش را تنظیم کنند.
 */
export const FloatingHelpVideos = () => {
  const location = useLocation();
  const routeWithQuery = `${location.pathname}${location.search}`;
  const { videos: exact } = useFloatingHelpVideos(routeWithQuery);
  const { videos: byPath } = useFloatingHelpVideos(location.pathname);

  const { isCEO } = useCEORole();
  const { isAdmin } = useAdminRole();
  const { isGeneralManager } = useGeneralManagerRole();
  const canManage = isCEO || isAdmin || isGeneralManager;

  const seen = new Set<string>();
  const videos = [...exact, ...byPath].filter((v) => {
    if (seen.has(v.id)) return false;
    seen.add(v.id);
    return true;
  });

  if (videos.length === 0) return null;

  return (
    <>
      {videos.map((v) => (
        <HelpBubble key={v.id} video={v} canManage={canManage} />
      ))}
    </>
  );
};

export default FloatingHelpVideos;
