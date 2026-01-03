import { Bell, X, Loader2, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useNajvaSubscription } from '@/hooks/useNajvaSubscription';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';

const DISMISSAL_KEY = 'notification-banner-dismissed';
const DISMISSAL_DURATION = 4 * 60 * 60 * 1000; // 4 ساعت

interface NotificationBannerProps {
  variant?: 'floating' | 'inline';
}

export function NotificationBanner({ variant = 'floating' }: NotificationBannerProps) {
  const { user } = useAuth();
  const navigate = useNavigate();

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
  const [showDialog, setShowDialog] = useState(false);
  const [showDeniedHelp, setShowDeniedHelp] = useState(false);

  const [isSupported, setIsSupported] = useState(true);
  const [permission, setPermission] = useState<NotificationPermission>('default');

  const { isSubscribed, subscribe, isLoading } = useNajvaSubscription();
  const { toast } = useToast();

  useEffect(() => {
    if (!('Notification' in window)) {
      setIsSupported(false);
      return;
    }
    setPermission(Notification.permission);
  }, []);

  // نمایش دیالوگ سفارشی برای فعال‌سازی اعلان‌ها (نجوا)
  useEffect(() => {
    if (!user || !isSupported || isSubscribed || dismissed || isLoading) {
      setShowDialog(false);
      return;
    }

    if (permission === 'denied') {
      setShowDeniedHelp(true);
    }

    // نمایش دیالوگ سفارشی با تأخیر
    if (permission !== 'granted') {
      const timer = setTimeout(() => {
        setShowDialog(true);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [user, isSupported, permission, dismissed, isSubscribed, isLoading]);

  const handleDismiss = () => {
    setDismissed(true);
    setShowDialog(false);
    localStorage.setItem(
      DISMISSAL_KEY,
      JSON.stringify({
        timestamp: Date.now(),
      })
    );
  };

  const handleEnable = async () => {
    setEnabling(true);

    const timeoutId = setTimeout(() => {
      setEnabling(false);
      toast({
        title: 'خطا',
        description: 'لطفاً صفحه را رفرش کرده و دوباره تلاش کنید.',
        variant: 'destructive',
      });
    }, 15000);

    try {
      if (!user) {
        clearTimeout(timeoutId);
        throw new Error('not authenticated');
      }

      const result = await subscribe();
      clearTimeout(timeoutId);

      setPermission(Notification.permission);

      if (result) {
        toast({
          title: 'اعلان‌ها فعال شد',
          description: 'از این پس پیام‌ها و به‌روزرسانی سفارشات را دریافت خواهید کرد',
        });
        setDismissed(true);
        setShowDialog(false);
        setShowDeniedHelp(false);
      } else {
        // اگر subscribe false شد، احتمالاً permission یا SDK/ServiceWorker مشکل دارد
        setShowDeniedHelp(Notification.permission === 'denied');
      }
    } catch (error: any) {
      clearTimeout(timeoutId);
      console.error('Error enabling notifications:', error);

      let errorMessage = 'فعال‌سازی اعلان‌ها با مشکل مواجه شد. لطفاً دوباره تلاش کنید.';

      if (error?.message?.includes('not authenticated')) {
        errorMessage = 'لطفاً ابتدا وارد حساب کاربری شوید';
      }

      toast({
        title: 'خطا',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setEnabling(false);
    }
  };

  const handleGoToSettings = () => {
    setShowDialog(false);
    setShowDeniedHelp(false);
    navigate('/settings/notifications');
  };

  // اگر شرایط نمایش وجود نداشت، چیزی نمایش نده
  if (!user || !isSupported || isSubscribed || dismissed) {
    return null;
  }

  return (
    <Dialog open={showDialog} onOpenChange={(open) => {
      if (!open) handleDismiss();
    }}>
      <DialogContent className="max-w-[420px] w-[90vw] border-0 bg-card/95 backdrop-blur-xl shadow-2xl rounded-3xl p-0 overflow-hidden">
        {/* دکمه بستن */}
        <button
          onClick={handleDismiss}
          className="absolute left-4 top-4 p-1.5 rounded-full bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors z-10"
          aria-label="بستن"
        >
          <X className="h-4 w-4" />
        </button>

        {showDeniedHelp ? (
          /* حالت رد شدن دسترسی */
          <div className="p-6 pt-10 space-y-5">
            <div className="flex items-center justify-center">
              <div className="p-4 rounded-2xl bg-destructive/10 border-2 border-destructive/30">
                <Settings className="h-10 w-10 text-destructive" />
              </div>
            </div>
            
            <h2 className="text-center text-xl font-bold text-foreground">
              دسترسی رد شده است
            </h2>
            
            <div className="flex items-center gap-3 p-3 bg-destructive/10 rounded-xl border border-destructive/30">
              <X className="h-5 w-5 text-destructive flex-shrink-0" />
              <p className="text-sm text-destructive font-medium">
                دسترسی اعلان در مرورگر مسدود شده است
              </p>
            </div>
            
            <div className="text-right space-y-3 bg-muted/50 p-4 rounded-xl border border-border/50">
              <p className="font-semibold text-foreground text-sm">برای فعال‌سازی:</p>
              <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                <li>روی آیکون قفل کنار آدرس سایت کلیک کنید</li>
                <li>گزینه اعلان‌ها یا Notifications را پیدا کنید</li>
                <li>آن را از مسدود به اجازه تغییر دهید</li>
                <li>صفحه را رفرش کنید</li>
              </ol>
            </div>
            
            <div className="flex flex-col gap-3">
              <Button 
                onClick={handleGoToSettings}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg py-5"
                size="lg"
              >
                <Settings className="h-5 w-5 ml-2" />
                رفتن به تنظیمات اعلان‌ها
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowDeniedHelp(false)}
                className="w-full border-border hover:bg-muted text-foreground"
              >
                تلاش مجدد
              </Button>
            </div>
          </div>
        ) : (
          /* حالت عادی درخواست اعلان - طراحی همسو با سایت */
          <div className="px-8 py-8 pt-12 space-y-6">
            {/* آیکون زنگ با استایل طلایی */}
            <div className="flex items-center justify-center">
              <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-400/25 to-amber-500/15 border border-amber-400/40">
                <Bell className="h-12 w-12 text-amber-500" />
              </div>
            </div>
            
            {/* عنوان */}
            <h2 className="text-center text-2xl font-bold text-foreground">
              پیام های سایت
            </h2>
            
            {/* توضیحات */}
            <p className="text-muted-foreground text-base text-center leading-relaxed">
              می‌خواهید از مراحل سفارش و پیام ها آگاه باشید؟
            </p>
            
            {/* دکمه بله - آبی مطابق استایل سایت */}
            <Button 
              onClick={handleEnable} 
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg py-7 text-lg rounded-2xl mt-4"
              size="lg"
              disabled={enabling}
            >
              {enabling ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin ml-2" />
                  در حال فعال‌سازی...
                </>
              ) : (
                'بله'
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
