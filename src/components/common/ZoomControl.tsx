import { useState, useEffect } from "react";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
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
    document.documentElement.style.zoom = `${level}%`;
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

  return (
    <TooltipProvider>
      <div className="hidden lg:flex fixed bottom-4 left-4 z-50 items-center gap-1 bg-card/95 backdrop-blur-sm border border-border rounded-full px-2 py-1 shadow-lg">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full"
              onClick={handleZoomOut}
              disabled={zoomIndex === 0}
            >
              <ZoomOut className="h-4 w-4" />
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
              className="h-8 px-2 text-xs font-medium min-w-[3rem]"
              onClick={handleReset}
            >
              {currentZoom}٪
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>بازگشت به حالت عادی</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full"
              onClick={handleZoomIn}
              disabled={zoomIndex === ZOOM_LEVELS.length - 1}
            >
              <ZoomIn className="h-4 w-4" />
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
