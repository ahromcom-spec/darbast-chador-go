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

  useEffect(() => {
    const pageLoadTime = Date.now();
    
    // اگر برنامه نصب شده است، منطق متفاوت دارد
    if (isStandalone) {
      const lastVisit = localStorage.getItem('pwa-last-visit');
      const now = Date.now();
      
      // فقط اگر 7 روز گذشته باشد
      if (lastVisit) {
        const daysSinceLastVisit = (now - parseInt(lastVisit)) / (1000 * 60 * 60 * 24);
        if (daysSinceLastVisit < 7) {
          return; // نشان نده
        }
        
        // اگر 7 روز گذشته، فقط برای 3 روز نشان بده
        const reminderShownDate = localStorage.getItem('pwa-reminder-shown');
        if (reminderShownDate) {
          const daysSinceReminder = (now - parseInt(reminderShownDate)) / (1000 * 60 * 60 * 24);
          if (daysSinceReminder < 3) {
            // در این 3 روز نشان بده
          } else {
            return; // 3 روز تمام شده، نشان نده
          }
        } else {
          localStorage.setItem('pwa-reminder-shown', now.toString());
        }
      }
      
      localStorage.setItem('pwa-last-visit', now.toString());
    }

    // نمایش فوری
    setShow(true);

    const interval = setInterval(() => {
      const elapsed = Date.now() - pageLoadTime;
      
      // در 2 دقیقه اول همیشه نمایش بده
      if (elapsed < 120000) {
        setShow(true);
      } else {
        // بعد از 2 دقیقه: هر 30 ثانیه نمایش بده و پنهان کن
        const cyclePosition = (elapsed - 120000) % 30000;
        setShow(cyclePosition < 15000);
      }
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [isStandalone]);

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
    <div className="fixed bottom-4 right-4 z-50 max-w-md">
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
