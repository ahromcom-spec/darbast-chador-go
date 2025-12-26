import { Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useLocation } from 'react-router-dom';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect, useRef } from 'react';

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
  // ثابت در راست-پایین با فاصله مشخص از footer و آواتار
  // فاصله از پایین: 80px (بالای footer)، فاصله از راست: 16px
  const BOTTOM_OFFSET = 80; // فاصله از پایین viewport (بالای فوتر)
  const RIGHT_OFFSET = 16;  // فاصله از راست
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
  // فقط در صفحه اصلی نمایش بده
  if (!show || location.pathname !== '/') {
    return null;
  }

  return (
    <div 
      ref={bannerRef}
      className="fixed z-40 select-none"
      style={{
        right: `${RIGHT_OFFSET}px`,
        bottom: `${BOTTOM_OFFSET}px`,
      }}
      data-pwa-install-banner
    >
      <Card className="border-primary/30 bg-card/95 backdrop-blur-sm shadow-lg">
        <div className="p-2 sm:p-3 flex items-center gap-2 sm:gap-3">
          <div className="flex-shrink-0 p-1.5 sm:p-2 rounded-lg bg-primary/10">
            <Download className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0 whitespace-nowrap">
            <h3 className="font-semibold text-xs sm:text-sm">نصب برنامه اهرم</h3>
            <p className="text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap">
              برای تجربه بهتر، برنامه را نصب کنید
            </p>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
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
