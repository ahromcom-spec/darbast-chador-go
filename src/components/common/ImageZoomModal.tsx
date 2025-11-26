import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { X, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ImageZoomModalProps {
  imageUrl: string;
  isOpen: boolean;
  onClose: () => void;
  images?: string[];
  initialIndex?: number;
}

export const ImageZoomModal: React.FC<ImageZoomModalProps> = ({ 
  imageUrl, 
  isOpen, 
  onClose,
  images = [],
  initialIndex = 0
}) => {
  const [zoom, setZoom] = useState(1);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  const hasMultipleImages = images.length > 1;
  const currentImageUrl = hasMultipleImages ? images[currentIndex] : imageUrl;

  useEffect(() => {
    setCurrentIndex(initialIndex);
    setZoom(1);
  }, [initialIndex, isOpen]);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.5, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.5, 1));

  const handleNext = () => {
    if (hasMultipleImages) {
      setCurrentIndex((prev) => (prev + 1) % images.length);
      setZoom(1);
    }
  };

  const handlePrev = () => {
    if (hasMultipleImages) {
      setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
      setZoom(1);
    }
  };

  // Swipe functionality
  useEffect(() => {
    if (!hasMultipleImages || !imageContainerRef.current) return;

    const container = imageContainerRef.current;
    let startX = 0;
    let startY = 0;
    let isDragging = false;

    const handleStart = (e: TouchEvent | MouseEvent) => {
      isDragging = true;
      startX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      startY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    };

    const handleMove = (e: TouchEvent | MouseEvent) => {
      if (!isDragging) return;

      const currentX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const currentY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const diffX = startX - currentX;
      const diffY = startY - currentY;

      // فقط اگر حرکت افقی بیشتر از عمودی بود
      if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 10) {
        e.preventDefault();
      }
    };

    const handleEnd = (e: TouchEvent | MouseEvent) => {
      if (!isDragging) return;
      isDragging = false;

      const endX = 'changedTouches' in e ? e.changedTouches[0].clientX : (e as MouseEvent).clientX;
      const diffX = startX - endX;

      // حداقل 50 پیکسل حرکت
      if (Math.abs(diffX) > 50) {
        if (diffX > 0) {
          handleNext();
        } else {
          handlePrev();
        }
      }
    };

    container.addEventListener('touchstart', handleStart as any, { passive: true });
    container.addEventListener('touchmove', handleMove as any, { passive: false });
    container.addEventListener('touchend', handleEnd as any, { passive: true });
    container.addEventListener('mousedown', handleStart as any);
    container.addEventListener('mousemove', handleMove as any);
    container.addEventListener('mouseup', handleEnd as any);
    container.addEventListener('mouseleave', () => { isDragging = false; });

    return () => {
      container.removeEventListener('touchstart', handleStart as any);
      container.removeEventListener('touchmove', handleMove as any);
      container.removeEventListener('touchend', handleEnd as any);
      container.removeEventListener('mousedown', handleStart as any);
      container.removeEventListener('mousemove', handleMove as any);
      container.removeEventListener('mouseup', handleEnd as any);
    };
  }, [hasMultipleImages, images.length]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 overflow-hidden">
        <div className="relative w-full h-[90vh] bg-black/95 flex items-center justify-center">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 z-50 bg-background/80 hover:bg-background"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>

          {hasMultipleImages && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-1/2 right-4 -translate-y-1/2 z-50 bg-black/60 hover:bg-black/80 text-white rounded-full w-12 h-12"
                onClick={handlePrev}
              >
                <ChevronRight className="h-6 w-6" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="absolute top-1/2 left-4 -translate-y-1/2 z-50 bg-black/60 hover:bg-black/80 text-white rounded-full w-12 h-12"
                onClick={handleNext}
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>

              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-black/70 text-white px-4 py-2 rounded-full text-sm font-medium">
                {currentIndex + 1} از {images.length}
              </div>
            </>
          )}

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex gap-2 bg-background/80 p-2 rounded-lg">
            <Button variant="ghost" size="icon" onClick={handleZoomOut} disabled={zoom <= 1}>
              <ZoomOut className="h-5 w-5" />
            </Button>
            <span className="px-4 py-2 text-sm font-medium">{Math.round(zoom * 100)}%</span>
            <Button variant="ghost" size="icon" onClick={handleZoomIn} disabled={zoom >= 3}>
              <ZoomIn className="h-5 w-5" />
            </Button>
          </div>

          <div 
            ref={imageContainerRef}
            className="overflow-auto max-w-full max-h-full p-4 cursor-grab active:cursor-grabbing"
          >
            <img
              src={currentImageUrl}
              alt="Zoomed"
              className="transition-transform duration-200 select-none"
              style={{ transform: `scale(${zoom})` }}
              draggable={false}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
