import { Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { useState, useEffect } from 'react';

export function PWAInstallBanner() {
  const { canInstall, isStandalone, promptInstall } = usePWAInstall();
  const [show, setShow] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

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

  // فقط در صفحه اصلی نمایش بده
  if (!show || location.pathname !== '/') {
    return null;
  }

  return (
    <div className="w-full max-w-[calc(100%-90px)] mr-auto" data-pwa-install-banner>
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
