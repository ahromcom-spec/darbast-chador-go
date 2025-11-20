import { Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useLocation } from 'react-router-dom';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { useState, useEffect } from 'react';

export function PWAInstallBanner() {
  const { canInstall, isStandalone, promptInstall } = usePWAInstall();
  const [show, setShow] = useState(false);
  const location = useLocation();

  // بازنشانی و نمایش بنر در صفحه اصلی
  useEffect(() => {
    if (location.pathname === '/') {
      // اگر برنامه قابل نصب باشد و هنوز نصب نشده باشد
      if (canInstall && !isStandalone) {
        setShow(true);
      } else {
        setShow(false);
      }
    } else {
      setShow(false);
    }
  }, [location.pathname, canInstall, isStandalone]);

  const handleDismiss = () => {
    setShow(false);
  };

  const handleInstall = async () => {
    const result = await promptInstall();
    if (result.outcome === 'accepted') {
      setShow(false);
    }
  };

  // فقط در صفحه اصلی نمایش بده
  if (!show || location.pathname !== '/') {
    return null;
  }

  return (
    <div className="fixed bottom-20 right-4 z-[100] max-w-md">
      <Card className="border-primary/30 bg-card/95 backdrop-blur-sm shadow-xl">
        <div className="p-4 flex items-center gap-3">
          <div className="flex-shrink-0 p-2 rounded-lg bg-primary/10">
            <Download className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm">نصب برنامه اهرم</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              برای تجربه بهتر، برنامه را نصب کنید
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleInstall}
              size="sm"
              className="gap-2"
            >
              <Download className="h-3 w-3" />
              نصب
            </Button>
            <Button
              onClick={handleDismiss}
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
