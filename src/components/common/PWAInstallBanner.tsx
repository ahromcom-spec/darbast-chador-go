import { Download, X, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { useState, useEffect, useRef, useCallback } from 'react';

// Get viewport size
const getViewportSize = () => ({
  width: typeof window !== 'undefined' ? window.innerWidth : 400,
  height: typeof window !== 'undefined' ? window.innerHeight : 800
});

export function PWAInstallBanner() {
  const { canInstall, isStandalone, promptInstall } = usePWAInstall();
  const [show, setShow] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Drag state
  const [position, setPosition] = useState(() => {
    const vp = getViewportSize();
    const isMobile = vp.width < 640;
    // Position higher from bottom to avoid footer/ticker overlap
    const bottomOffset = isMobile ? 160 : 180;
    return { x: vp.width - 320, y: vp.height - bottomOffset };
  });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; posX: number; posY: number } | null>(null);
  const bannerRef = useRef<HTMLDivElement>(null);

  // بررسی و نمایش بنر بر اساس وضعیت نصب و localStorage
  useEffect(() => {
    const dismissedData = localStorage.getItem('pwa-install-dismissed');
    
    // بررسی اینکه آیا یک دقیقه از زمان dismiss گذشته است
    let shouldShow = false;
    if (location.pathname === '/' && !isStandalone) {
      if (!dismissedData) {
        shouldShow = true;
      } else {
        try {
          const { timestamp } = JSON.parse(dismissedData);
          const oneMinute = 60 * 1000; // یک دقیقه به میلی‌ثانیه
          const timePassed = Date.now() - timestamp;
          
          if (timePassed > oneMinute) {
            // اگر بیش از یک دقیقه گذشته باشد، بنر را دوباره نمایش بده
            shouldShow = true;
            localStorage.removeItem('pwa-install-dismissed');
          }
        } catch {
          // اگر فرمت قدیمی بود، بنر را نمایش بده
          shouldShow = true;
        }
      }
    }
    
    setShow(shouldShow);
  }, [location.pathname, isStandalone]);

  // Update position on resize
  useEffect(() => {
    const handleResize = () => {
      const vp = getViewportSize();
      const isMobile = vp.width < 640;
      const bottomOffset = isMobile ? 160 : 180;
      const bannerWidth = bannerRef.current?.offsetWidth || 300;
      
      setPosition(prev => ({
        x: Math.min(prev.x, vp.width - bannerWidth - 20),
        y: Math.min(prev.y, vp.height - bottomOffset)
      }));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleDismiss = () => {
    setShow(false);
    // ذخیره زمان dismiss با timestamp
    localStorage.setItem('pwa-install-dismissed', JSON.stringify({
      timestamp: Date.now()
    }));
  };

  const handleInstall = async () => {
    if (canInstall) {
      const result = await promptInstall();
      if (result.outcome === 'accepted') {
        setShow(false);
      }
    } else {
      // اگر پرامپت مستقیم در دسترس نباشد، کاربر را به صفحه راهنمای نصب ببریم
      navigate('/settings/install-app');
    }
  };

  // Drag handlers
  const handleDragStart = useCallback((clientX: number, clientY: number) => {
    dragStartRef.current = {
      x: clientX,
      y: clientY,
      posX: position.x,
      posY: position.y
    };
    setIsDragging(true);
  }, [position]);

  const handleDragMove = useCallback((clientX: number, clientY: number) => {
    if (!dragStartRef.current || !isDragging) return;

    const deltaX = clientX - dragStartRef.current.x;
    const deltaY = clientY - dragStartRef.current.y;

    const vp = getViewportSize();
    const bannerWidth = bannerRef.current?.offsetWidth || 300;
    const bannerHeight = bannerRef.current?.offsetHeight || 80;

    // Calculate new position with bounds
    const newX = Math.max(10, Math.min(vp.width - bannerWidth - 10, dragStartRef.current.posX + deltaX));
    const newY = Math.max(80, Math.min(vp.height - bannerHeight - 10, dragStartRef.current.posY + deltaY));

    setPosition({ x: newX, y: newY });
  }, [isDragging]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    dragStartRef.current = null;
  }, []);

  // Mouse events
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleDragStart(e.clientX, e.clientY);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      handleDragMove(e.clientX, e.clientY);
    };

    const handleMouseUp = () => {
      handleDragEnd();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  // Touch events
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    handleDragStart(touch.clientX, touch.clientY);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      handleDragMove(touch.clientX, touch.clientY);
    };

    const handleTouchEnd = () => {
      handleDragEnd();
    };

    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  // فقط در صفحه اصلی نمایش بده
  if (!show || location.pathname !== '/') {
    return null;
  }

  return (
    <div 
      ref={bannerRef}
      className="fixed z-50"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        touchAction: 'none',
        cursor: isDragging ? 'grabbing' : 'grab'
      }}
      data-pwa-install-banner
    >
      <Card className="border-primary/30 bg-card/95 backdrop-blur-sm shadow-lg">
        <div className="p-2 sm:p-4 flex items-center gap-2 sm:gap-3">
          {/* Drag handle */}
          <div
            className="flex-shrink-0 p-1 rounded cursor-grab active:cursor-grabbing touch-none text-muted-foreground hover:text-foreground transition-colors"
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
          >
            <GripVertical className="h-4 w-4" />
          </div>
          
          <div className="flex-shrink-0 p-1.5 sm:p-2 rounded-lg bg-primary/10">
            <Download className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-xs sm:text-sm">نصب برنامه اهرم</h3>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 hidden sm:block">
              برای تجربه بهتر، برنامه را نصب کنید
            </p>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <Button
              onClick={handleInstall}
              size="sm"
              className="gap-1 sm:gap-2 h-7 sm:h-8 px-2 sm:px-3 text-xs"
            >
              <Download className="h-3 w-3" />
              نصب
            </Button>
            <Button
              onClick={handleDismiss}
              variant="ghost"
              size="sm"
              className="h-7 w-7 sm:h-8 sm:w-8 p-0"
            >
              <X className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
