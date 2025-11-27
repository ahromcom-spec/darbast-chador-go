import { Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { usePushNotifications } from '@/hooks/usePushNotifications';

export function NotificationBanner() {
  const [dismissed, setDismissed] = useState(() => {
    const dismissedData = localStorage.getItem('notification-banner-dismissed');
    if (!dismissedData) return false;
    
    try {
      const { timestamp } = JSON.parse(dismissedData);
      const oneMinute = 60 * 1000; // یک دقیقه به میلی‌ثانیه
      const timePassed = Date.now() - timestamp;
      
      if (timePassed > oneMinute) {
        // اگر بیش از یک دقیقه گذشته باشد، بنر را دوباره نمایش بده
        localStorage.removeItem('notification-banner-dismissed');
        return false;
      }
      return true;
    } catch {
      // اگر فرمت قدیمی بود، بنر را نمایش بده
      return false;
    }
  });
  const location = useLocation();
  const { permission, isSupported, requestPermission } = usePushNotifications();

  const handleDismiss = () => {
    setDismissed(true);
    // ذخیره زمان dismiss با timestamp
    localStorage.setItem('notification-banner-dismissed', JSON.stringify({
      timestamp: Date.now()
    }));
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
    <div className="fixed bottom-20 left-4 z-[100] max-w-md" data-notification-banner>
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
          <Button
            onClick={handleEnable}
            size="sm"
            className="whitespace-nowrap"
          >
            فعال‌سازی
          </Button>
          <Button
            onClick={handleDismiss}
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 flex-shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
}
