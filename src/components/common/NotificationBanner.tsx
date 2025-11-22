import { Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { usePushNotifications } from '@/hooks/usePushNotifications';

export function NotificationBanner() {
  const [dismissed, setDismissed] = useState(false);
  const location = useLocation();
  const { permission, isSupported, requestPermission } = usePushNotifications();

  useEffect(() => {
    const dismissedTime = localStorage.getItem('notification-banner-dismissed-time');
    if (dismissedTime) {
      const timePassed = Date.now() - parseInt(dismissedTime);
      const oneMinute = 60 * 1000; // 1 دقیقه به میلی‌ثانیه
      
      if (timePassed < oneMinute) {
        setDismissed(true);
        // تایمر برای نمایش مجدد بعد از یک دقیقه
        const remainingTime = oneMinute - timePassed;
        setTimeout(() => {
          setDismissed(false);
          localStorage.removeItem('notification-banner-dismissed-time');
        }, remainingTime);
      } else {
        localStorage.removeItem('notification-banner-dismissed-time');
      }
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    const dismissTime = Date.now();
    localStorage.setItem('notification-banner-dismissed-time', dismissTime.toString());
  };

  const handleEnable = async () => {
    await requestPermission();
    if (permission === 'granted') {
      setDismissed(true);
    }
  };

  // فقط در صفحه اصلی نمایش بده
  if (!isSupported || permission === 'granted' || dismissed || location.pathname !== '/') {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 max-w-md">
      <Card className="border-primary/30 bg-card/95 backdrop-blur-sm shadow-xl">
        <div className="p-4 flex items-center gap-3">
          <div className="flex-shrink-0 p-2 rounded-lg bg-primary/10">
            <Bell className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm">دریافت اعلان‌های فوری</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              از سفارشات جدید و به‌روزرسانی‌ها مطلع شوید
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleEnable}
              size="sm"
              className="gap-2"
            >
              <Bell className="h-3 w-3" />
              فعال‌سازی
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
