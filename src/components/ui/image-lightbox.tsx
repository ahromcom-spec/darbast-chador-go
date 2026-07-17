import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, ZoomIn, ZoomOut, RotateCcw, Download, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ImageLightboxProps {
  src: string | null;
  alt?: string;
  title?: string;
  onClose: () => void;
  downloadName?: string;
}

/**
 * Full-screen image viewer with zoom (wheel + buttons), pan (drag), and download.
 * Renders via portal directly to <body> and ignores the app-zoom CSS variable so
 * the viewer always fills the real viewport regardless of in-app zoom settings.
 */
export function ImageLightbox({ src, alt = "", title = "نمایش تصویر", onClose, downloadName }: ImageLightboxProps) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    if (!src) return;
    setScale(1);
    setOffset({ x: 0, y: 0 });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "+" || e.key === "=") setScale(s => Math.min(s + 0.25, 6));
      if (e.key === "-") setScale(s => Math.max(s - 0.25, 0.25));
      if (e.key === "0") { setScale(1); setOffset({ x: 0, y: 0 }); }
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [src, onClose]);

  if (!src) return null;

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.15 : -0.15;
    setScale(s => Math.min(Math.max(s + delta, 0.25), 6));
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (scale <= 1) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    setOffset({
      x: dragRef.current.ox + (e.clientX - dragRef.current.x),
      y: dragRef.current.oy + (e.clientY - dragRef.current.y),
    });
  };
  const handlePointerUp = () => { dragRef.current = null; };

  const reset = () => { setScale(1); setOffset({ x: 0, y: 0 }); };

  return createPortal(
    <div
      // Inline style with zoom:1 to neutralize any inherited --app-zoom
      style={{ zoom: 1 }}
      className="fixed inset-0 z-[200] flex flex-col bg-black/95 text-white"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Top toolbar */}
      <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-black/60 px-4 py-3 backdrop-blur-sm">
        <div className="truncate text-sm font-medium">{title}</div>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" className="text-white hover:bg-white/10" onClick={() => setScale(s => Math.max(s - 0.25, 0.25))} title="کوچک‌نمایی">
            <ZoomOut className="h-5 w-5" />
          </Button>
          <span className="min-w-[3.5rem] text-center text-xs tabular-nums">{Math.round(scale * 100)}%</span>
          <Button size="icon" variant="ghost" className="text-white hover:bg-white/10" onClick={() => setScale(s => Math.min(s + 0.25, 6))} title="بزرگ‌نمایی">
            <ZoomIn className="h-5 w-5" />
          </Button>
          <Button size="icon" variant="ghost" className="text-white hover:bg-white/10" onClick={reset} title="بازنشانی">
            <RotateCcw className="h-5 w-5" />
          </Button>
          <Button size="icon" variant="ghost" className="text-white hover:bg-white/10" onClick={() => setScale(s => (s < 2 ? 2 : 1))} title="حداکثر / حداقل">
            <Maximize2 className="h-5 w-5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="text-white hover:bg-white/10"
            title="دانلود"
            onClick={() => {
              const link = document.createElement("a");
              link.href = src;
              link.download = downloadName || "image.jpg";
              link.click();
            }}
          >
            <Download className="h-5 w-5" />
          </Button>
          <Button size="icon" variant="ghost" className="text-white hover:bg-white/10" onClick={onClose} title="بستن">
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Image area */}
      <div
        className="relative flex-1 overflow-hidden"
        onWheel={handleWheel}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onDoubleClick={() => setScale(s => (s < 2 ? 2 : 1))}
          style={{
            transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            cursor: scale > 1 ? (dragRef.current ? "grabbing" : "grab") : "zoom-in",
            transition: dragRef.current ? "none" : "transform 0.15s ease-out",
          }}
          className="pointer-events-auto absolute left-1/2 top-1/2 max-h-[calc(100vh-8rem)] max-w-[calc(100vw-2rem)] select-none object-contain"
        />
      </div>

      {/* Bottom hint */}
      <div className="border-t border-white/10 bg-black/60 px-4 py-2 text-center text-xs text-white/70">
        برای زوم از چرخ ماوس یا دکمه‌ها استفاده کنید — برای جابجایی، تصویر را بکشید — دابل کلیک برای زوم سریع — Esc برای بستن
      </div>
    </div>,
    document.body,
  );
}
