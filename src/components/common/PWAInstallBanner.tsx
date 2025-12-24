import { Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useLocation } from 'react-router-dom';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect, useRef, useCallback } from 'react';

// Get viewport size
const getViewportSize = () => ({
  width: typeof window !== 'undefined' ? window.innerWidth : 400,
  height: typeof window !== 'undefined' ? window.innerHeight : 800
});

export function PWAInstallBanner() {
  const { canInstall, isStandalone, promptInstall } = usePWAInstall();
  const { toast } = useToast();
  const [show, setShow] = useState(false);
  const location = useLocation();
  // محاسبه پوزیشن پیش‌فرض - پایین سمت راست
  const getDefaultPosition = () => {
    const vp = getViewportSize();
    const bannerWidth = 320;
    const bannerHeight = 70;
    // در پایین سمت راست صفحه
    const x = vp.width - bannerWidth - 16;
    const y = vp.height - bannerHeight - 80;
    return { x, y };
  };

  // Drag state - شروع از سمت راست
  const [position, setPosition] = useState(() => {
    const vp = getViewportSize();
    const bannerWidth = 320;
    const bannerHeight = 70;
    return { 
      x: Math.max(16, vp.width - bannerWidth - 16), 
      y: vp.height - bannerHeight - 80 
    };
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
    
    // ریست پوزیشن به پیش‌فرض سمت راست با هر تغییر صفحه
    const vp = getViewportSize();
    const bannerWidth = 320;
    const bannerHeight = 70;
    setPosition({ 
      x: Math.max(16, vp.width - bannerWidth - 16), 
      y: vp.height - bannerHeight - 80 
    });
  }, [location.pathname, isStandalone]);

  // Update position on resize
  // Banner restricted to bottom half of screen
  useEffect(() => {
    const handleResize = () => {
      const vp = getViewportSize();
      const bannerWidth = bannerRef.current?.offsetWidth || 200;
      const bannerHeight = bannerRef.current?.offsetHeight || 70;
      // فقط محدود به پایین صفحه
      const minY = vp.height / 2;
      const maxX = vp.width - bannerWidth - 8;
      const maxY = vp.height - bannerHeight - 8;
      
      setPosition(prev => ({
        x: Math.max(8, Math.min(maxX, prev.x)),
        y: Math.max(minY, Math.min(maxY, prev.y))
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
    // اول سعی کن از پرامپت ذخیره شده استفاده کنی
    const promptEvent = (window as any).__deferredPrompt;

    if (promptEvent && typeof promptEvent.prompt === 'function') {
      try {
        await promptEvent.prompt();
        const choiceResult = await promptEvent.userChoice;
        (window as any).__deferredPrompt = null;
        if (choiceResult.outcome === 'accepted') {
          setShow(false);
        }
        return;
      } catch (err) {
        console.error('PWA install prompt failed:', err);
      }
    }

    // اگر پرامپت hook در دسترس باشد
    if (canInstall) {
      const result = await promptInstall();
      if (result.outcome === 'accepted') {
        setShow(false);
      }
      return;
    }

    // اگر هنوز شرایط نصب فراهم نشده باشد، پیام مناسب بده
    const isFirefox = typeof navigator !== 'undefined' && /firefox/i.test(navigator.userAgent);

    toast({
      title: isFirefox ? 'نصب در فایرفاکس' : 'نصب در ویندوز',
      description: isFirefox
        ? 'مرورگر Firefox در ویندوز نصب مستقیم برنامه (PWA) را پشتیبانی نمی‌کند. لطفاً با Chrome یا Edge امتحان کنید.'
        : 'اگر آیکون نصب در نوار آدرس مرورگر Edge/Chrome نمایش داده می‌شود روی آن بزنید. اگر دیده نمی‌شود، یک‌بار صفحه را رفرش کنید.'
    });
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
    const bannerWidth = bannerRef.current?.offsetWidth || 200;
    const bannerHeight = bannerRef.current?.offsetHeight || 70;

    // فقط محدود به پایین صفحه
    const minY = vp.height / 2;
    const maxX = vp.width - bannerWidth - 8;
    const maxY = vp.height - bannerHeight - 8;

    // Calculate new position with bounds
    const newX = Math.max(8, Math.min(maxX, dragStartRef.current.posX + deltaX));
    const newY = Math.max(minY, Math.min(maxY, dragStartRef.current.posY + deltaY));

    setPosition({ x: newX, y: newY });
  }, [isDragging]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    dragStartRef.current = null;
  }, []);

  // Mouse events
  const handleMouseDown = (e: React.MouseEvent) => {
    // Don't start drag if clicking on buttons
    if ((e.target as HTMLElement).closest('button')) return;
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
    // Don't start drag if touching buttons
    if ((e.target as HTMLElement).closest('button')) return;
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
      className="fixed z-50 select-none"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        touchAction: 'none',
        cursor: isDragging ? 'grabbing' : 'grab'
      }}
      data-pwa-install-banner
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      <Card className="border-primary/30 bg-card/95 backdrop-blur-sm shadow-lg">
        <div className="p-2 sm:p-4 flex items-center gap-2 sm:gap-3">
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
