import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { useZoom } from '@/contexts/ZoomContext';

export function MobileZoomControls() {
  const { isMobile, zoomPercentage, zoomIn, zoomOut, resetZoom, zoomLevel } = useZoom();

  // Only show on mobile & only when zoom is not 100%
  if (!isMobile) return null;

  const isDefault = zoomLevel === 1;

  return (
    <div className="fixed bottom-20 left-3 z-[9999] flex flex-col items-center gap-1" dir="ltr">
      {/* Show reset button only when zoomed */}
      {!isDefault && (
        <button
          onClick={resetZoom}
          className="flex items-center justify-center w-9 h-9 rounded-full bg-background/90 border border-border shadow-lg backdrop-blur-sm active:scale-95 transition-transform"
          aria-label="بازگشت به اندازه اصلی"
        >
          <RotateCcw className="h-4 w-4 text-foreground" />
        </button>
      )}
      
      <button
        onClick={zoomIn}
        className="flex items-center justify-center w-9 h-9 rounded-full bg-background/90 border border-border shadow-lg backdrop-blur-sm active:scale-95 transition-transform"
        aria-label="بزرگنمایی"
      >
        <ZoomIn className="h-4 w-4 text-foreground" />
      </button>
      
      {/* Percentage badge */}
      <span className="text-[10px] font-medium text-muted-foreground select-none">
        {zoomPercentage}%
      </span>

      <button
        onClick={zoomOut}
        className="flex items-center justify-center w-9 h-9 rounded-full bg-background/90 border border-border shadow-lg backdrop-blur-sm active:scale-95 transition-transform"
        aria-label="کوچکنمایی"
      >
        <ZoomOut className="h-4 w-4 text-foreground" />
      </button>
    </div>
  );
}
