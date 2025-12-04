import { Bell, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

const DISMISSAL_KEY = 'notification-banner-dismissed';
const DISMISSAL_DURATION = 24 * 60 * 60 * 1000; // 24 ساعت

export function NotificationBanner() {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(() => {
    const dismissedData = localStorage.getItem(DISMISSAL_KEY);
    if (!dismissedData) return false;
    
    try {
      const { timestamp } = JSON.parse(dismissedData);
      const timePassed = Date.now() - timestamp;
      
      if (timePassed > DISMISSAL_DURATION) {
        localStorage.removeItem(DISMISSAL_KEY);
        return false;
      }
      return true;
    } catch {
      return false;
    }
  });
  const [enabling, setEnabling] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const location = useLocation();
  const { permission, isSupported, requestPermission, subscribeToPush, subscription } = usePushNotifications();
  const { toast } = useToast();

  // نمایش بنر بعد از 2 ثانیه اگر کاربر لاگین کرده
  useEffect(() => {
    if (!user || !isSupported || permission === 'granted' || dismissed || subscription) {
      setShowBanner(false);
      return;
    }
    
    // نمایش بنر پس از تاخیر کوتاه
    const timer = setTimeout(() => {
      setShowBanner(true);
    }, 2000);
    
    return () => clearTimeout(timer);
  }, [user, isSupported, permission, dismissed, subscription]);

  const handleDismiss = () => {
    setDismissed(true);
    setShowBanner(false);
    localStorage.setItem(DISMISSAL_KEY, JSON.stringify({
      timestamp: Date.now()
    }));
  };

  const handleEnable = async () => {
    setEnabling(true);
    try {
      // ابتدا درخواست مجوز
      const result = await requestPermission();
      
      if (result === 'granted') {
        // سپس ثبت دستگاه برای دریافت اعلان
        await subscribeToPush();
        toast({
          title: 'اعلان‌ها فعال شد',
          description: 'از این پس تماس‌های ورودی و به‌روزرسانی سفارشات را دریافت خواهید کرد',
        });
        setDismissed(true);
        setShowBanner(false);
      } else if (result === 'denied') {
        toast({
          title: 'دسترسی رد شد',
          description: 'لطفا در تنظیمات مرورگر اجازه ارسال اعلان را فعال کنید',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error enabling notifications:', error);
      toast({
        title: 'خطا',
        description: 'فعال‌سازی اعلان‌ها با مشکل مواجه شد',
        variant: 'destructive'
      });
    } finally {
      setEnabling(false);
    }
  };

  // فقط نمایش اگر کاربر لاگین کرده و اشتراک نداشته باشد
  if (!showBanner) {
    return null;
  }

  return (
    <div className="fixed bottom-20 left-4 z-[100] max-w-md animate-in slide-in-from-bottom-4" data-notification-banner>
      <Card className="border-primary/30 bg-card/95 backdrop-blur-sm shadow-xl">
        <div className="p-4 flex items-center gap-3">
          <div className="flex-shrink-0 p-2 rounded-lg bg-primary/10">
            <Bell className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm">دریافت اعلان تماس‌های ورودی</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              از تماس‌های مدیران و وضعیت سفارشات مطلع شوید
            </p>
          </div>
          <Button
            onClick={handleEnable}
            size="sm"
            className="whitespace-nowrap"
            disabled={enabling}
          >
            {enabling ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin ml-1" />
                در حال فعال‌سازی
              </>
            ) : (
              'فعال‌سازی'
            )}
          </Button>
          <Button
            onClick={handleDismiss}
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 flex-shrink-0"
            disabled={enabling}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
}
