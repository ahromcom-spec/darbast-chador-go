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
  /** index of currently-selected profile image (for showing status) */
  activeIndex?: number;
  /** called when user explicitly selects current image */
  onSelect?: (index: number) => void;
  /** deprecated (no longer triggered by next/prev) */
  onImageChange?: (newIndex: number) => void;
}

export const ImageZoomModal: React.FC<ImageZoomModalProps> = ({ 
  imageUrl, 
  isOpen, 
  onClose,
  images = [],
  initialIndex = 0,
  activeIndex,
  onSelect
}) => {
  const [zoom, setZoom] = useState(1);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const imageContainerRef = useRef<HTMLDivElement>(null);

  const hasMultipleImages = images.length > 1;
  const currentImageUrl = hasMultipleImages ? images[currentIndex] : imageUrl;

  const prevIndex = hasMultipleImages ? (currentIndex - 1 + images.length) % images.length : 0;
  const nextIndex = hasMultipleImages ? (currentIndex + 1) % images.length : 0;
  const prevThumbUrl = hasMultipleImages ? images[prevIndex] : undefined;
  const nextThumbUrl = hasMultipleImages ? images[nextIndex] : undefined;
  const isActive = activeIndex != null && activeIndex === currentIndex;

  useEffect(() => {
    setCurrentIndex(initialIndex);
    setZoom(1);
    setPosition({ x: 0, y: 0 });
    setIsDragging(false);
  }, [initialIndex, isOpen]);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.5, 3));
  const handleZoomOut = () => {
    setZoom(prev => {
      const newZoom = Math.max(prev - 0.5, 1);
      if (newZoom === 1) {
        setPosition({ x: 0, y: 0 });
      }
      return newZoom;
    });
  };

  const handleNext = () => {
    if (hasMultipleImages) {
      const newIndex = (currentIndex + 1) % images.length;
      setCurrentIndex(newIndex);
      setZoom(1);
      setPosition({ x: 0, y: 0 });
    }
  };

  const handlePrev = () => {
    if (hasMultipleImages) {
      const newIndex = (currentIndex - 1 + images.length) % images.length;
      setCurrentIndex(newIndex);
      setZoom(1);
      setPosition({ x: 0, y: 0 });
    }
  };

  // Pan/Drag functionality for zoomed image
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (zoom <= 1) return;
    
    e.preventDefault();
    setIsDragging(true);
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    setDragStart({
      x: clientX - position.x,
      y: clientY - position.y
    });
  };

  const handleDragMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging || zoom <= 1) return;
    
    e.preventDefault();
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    setPosition({
      x: clientX - dragStart.x,
      y: clientY - dragStart.y
    });
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  // Swipe functionality for changing images (only when zoom = 1)
  useEffect(() => {
    if (!hasMultipleImages || !imageContainerRef.current) return;

    const container = imageContainerRef.current;
    let startX = 0;
    let startY = 0;
    let isSwiping = false;

    const handleStart = (e: TouchEvent | MouseEvent) => {
      // فقط برای تصاویر zoom نشده
      if (zoom > 1) return;
      
      isSwiping = true;
      startX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      startY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    };

    const handleMove = (e: TouchEvent | MouseEvent) => {
      if (!isSwiping || zoom > 1) return;

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
      if (!isSwiping || zoom > 1) return;
      isSwiping = false;

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
    container.addEventListener('mouseleave', () => { isSwiping = false; });

    return () => {
      container.removeEventListener('touchstart', handleStart as any);
      container.removeEventListener('touchmove', handleMove as any);
      container.removeEventListener('touchend', handleEnd as any);
      container.removeEventListener('mousedown', handleStart as any);
      container.removeEventListener('mousemove', handleMove as any);
      container.removeEventListener('mouseup', handleEnd as any);
    };
  }, [hasMultipleImages, images.length, zoom]);

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
              {/* Right side (Next) */}
              {nextThumbUrl && (
                <button
                  type="button"
                  onClick={handleNext}
                  className="absolute top-1/2 right-24 -translate-y-1/2 z-40 h-16 w-16 md:h-20 md:w-20 rounded-xl overflow-hidden border border-white/20 shadow-lg opacity-70 hover:opacity-100 transition-opacity"
                  aria-label="پیش‌نمایش عکس بعدی"
                >
                  <img src={nextThumbUrl} alt="" className="h-full w-full object-cover" />
                </button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-1/2 right-4 -translate-y-1/2 z-50 bg-black/70 hover:bg-black/90 text-white rounded-full w-14 h-14 shadow-lg border-2 border-white/20 transition-all hover:scale-110"
                onClick={handleNext}
                aria-label="عکس بعدی"
              >
                <ChevronRight className="h-7 w-7" />
              </Button>

              {/* Left side (Prev) */}
              {prevThumbUrl && (
                <button
                  type="button"
                  onClick={handlePrev}
                  className="absolute top-1/2 left-24 -translate-y-1/2 z-40 h-16 w-16 md:h-20 md:w-20 rounded-xl overflow-hidden border border-white/20 shadow-lg opacity-70 hover:opacity-100 transition-opacity"
                  aria-label="پیش‌نمایش عکس قبلی"
                >
                  <img src={prevThumbUrl} alt="" className="h-full w-full object-cover" />
                </button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-1/2 left-4 -translate-y-1/2 z-50 bg-black/70 hover:bg-black/90 text-white rounded-full w-14 h-14 shadow-lg border-2 border-white/20 transition-all hover:scale-110"
                onClick={handlePrev}
                aria-label="عکس قبلی"
              >
                <ChevronLeft className="h-7 w-7" />
              </Button>

              <div dir="rtl" className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-black/80 text-white px-5 py-2.5 rounded-full text-base font-semibold shadow-lg border border-white/20">
                <span dir="ltr">{currentIndex + 1}</span> <span>از</span> <span dir="ltr">{images.length}</span>
                {isActive && <span className="mr-2 text-xs font-medium opacity-80">عکس پروفایل</span>}
              </div>
            </>
          )}

          {/* Explicit select button */}
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-50">
            <Button
              type="button"
              onClick={() => onSelect?.(currentIndex)}
              disabled={!onSelect || isActive}
              className="min-w-[190px]"
            >
              {isActive ? 'عکس پروفایل فعلی' : 'انتخاب به عنوان عکس پروفایل'}
            </Button>
          </div>

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex gap-2 bg-background/90 p-2 rounded-lg shadow-lg border border-border">
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
            className="overflow-hidden p-6 max-w-[92vw] max-h-[82vh]"
            style={{ 
              cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : (hasMultipleImages ? 'grab' : 'default'),
              touchAction: zoom > 1 ? 'none' : 'pan-x'
            }}
            onMouseDown={handleDragStart}
            onMouseMove={handleDragMove}
            onMouseUp={handleDragEnd}
            onMouseLeave={handleDragEnd}
            onTouchStart={handleDragStart}
            onTouchMove={handleDragMove}
            onTouchEnd={handleDragEnd}
          >
            <img
              src={currentImageUrl}
              alt="تصویر"
              className="select-none transition-none max-w-[88vw] max-h-[78vh] object-contain"
              style={{ 
                transform: `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)`,
                transformOrigin: 'center center'
              }}
              draggable={false}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
