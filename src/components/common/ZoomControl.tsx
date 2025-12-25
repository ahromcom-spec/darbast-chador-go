import { useState, useEffect } from "react";
import { ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const ZOOM_LEVELS = [85, 100, 115];
const ZOOM_STORAGE_KEY = "ahrom-zoom-level";

export const ZoomControl = () => {
  const [zoomIndex, setZoomIndex] = useState(1); // default 100%

  useEffect(() => {
    // Load saved zoom preference
    const saved = localStorage.getItem(ZOOM_STORAGE_KEY);
    if (saved) {
      const idx = ZOOM_LEVELS.indexOf(parseInt(saved));
      if (idx !== -1) {
        setZoomIndex(idx);
        applyZoom(parseInt(saved));
      }
    }
  }, []);

  const applyZoom = (level: number) => {
    const root = document.getElementById('root');
    if (root) {
      const scale = level / 100;
      root.style.transform = `scale(${scale})`;
      root.style.transformOrigin = 'top center';
      root.style.width = `${100 / scale}%`;
      root.style.minHeight = `${100 / scale}vh`;
    }
    localStorage.setItem(ZOOM_STORAGE_KEY, level.toString());
  };

  const handleZoomIn = () => {
    if (zoomIndex < ZOOM_LEVELS.length - 1) {
      const newIndex = zoomIndex + 1;
      setZoomIndex(newIndex);
      applyZoom(ZOOM_LEVELS[newIndex]);
    }
  };

  const handleZoomOut = () => {
    if (zoomIndex > 0) {
      const newIndex = zoomIndex - 1;
      setZoomIndex(newIndex);
      applyZoom(ZOOM_LEVELS[newIndex]);
    }
  };

  const handleReset = () => {
    setZoomIndex(1);
    applyZoom(100);
  };

  const currentZoom = ZOOM_LEVELS[zoomIndex];

  // Only show on large screens (desktop)
  return (
    <TooltipProvider>
      <div 
        className="hidden lg:flex fixed bottom-6 left-6 z-[9999] items-center gap-1 bg-card/95 backdrop-blur-sm border border-border rounded-full px-3 py-2 shadow-xl"
        style={{ transform: 'none', width: 'auto', minHeight: 'auto' }}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full hover:bg-primary/10"
              onClick={handleZoomOut}
              disabled={zoomIndex === 0}
            >
              <ZoomOut className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>کوچک‌نمایی (۸۵٪)</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 px-3 text-sm font-bold min-w-[4rem] hover:bg-primary/10"
              onClick={handleReset}
            >
              {currentZoom}٪
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>بازگشت به حالت عادی (۱۰۰٪)</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full hover:bg-primary/10"
              onClick={handleZoomIn}
              disabled={zoomIndex === ZOOM_LEVELS.length - 1}
            >
              <ZoomIn className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>بزرگ‌نمایی (۱۱۵٪)</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
};
