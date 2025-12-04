import { Bell, X, Loader2, Phone, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

const DISMISSAL_KEY = 'notification-banner-dismissed';
const DISMISSAL_DURATION = 4 * 60 * 60 * 1000; // 4 ساعت (کمتر از قبل تا بیشتر نمایش داده شود)

interface NotificationBannerProps {
  variant?: 'floating' | 'inline';
}

export function NotificationBanner({ variant = 'floating' }: NotificationBannerProps) {
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
  const [showDialog, setShowDialog] = useState(false);
  const location = useLocation();
  const { permission, isSupported, requestPermission, subscribeToPush, subscription } = usePushNotifications();
  const { toast } = useToast();

  // بررسی اگر کاربر هنوز اعلان ندارد - نمایش دیالوگ
  useEffect(() => {
    if (!user || !isSupported || subscription) {
      setShowBanner(false);
      setShowDialog(false);
      return;
    }

    // اگر اولین بار است یا مدت زیادی گذشته، دیالوگ نشان بده
    const hasSeenDialog = localStorage.getItem('notification-dialog-seen');
    const dialogTimestamp = hasSeenDialog ? parseInt(hasSeenDialog) : 0;
    const hoursSinceDialog = (Date.now() - dialogTimestamp) / (1000 * 60 * 60);

    // نمایش دیالوگ هر 12 ساعت تا کاربر فعال کند
    if (!subscription && hoursSinceDialog > 12) {
      const timer = setTimeout(() => {
        setShowDialog(true);
        localStorage.setItem('notification-dialog-seen', Date.now().toString());
      }, 3000);
      return () => clearTimeout(timer);
    }

    // نمایش بنر پایین صفحه
    if (permission !== 'granted' && !dismissed) {
      const timer = setTimeout(() => {
        setShowBanner(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
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
      const result = await requestPermission();
      
      if (result === 'granted') {
        await subscribeToPush();
        toast({
          title: '✅ اعلان‌ها فعال شد',
          description: 'از این پس تماس‌های ورودی و به‌روزرسانی سفارشات را دریافت خواهید کرد',
        });
        setDismissed(true);
        setShowBanner(false);
        setShowDialog(false);
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

  // نمایش inline بنر در بالای صفحه
  const showInline = variant === 'inline' && user && isSupported && !subscription && permission !== 'granted' && !dismissed;

  return (
    <>
      {/* بنر inline در بالای صفحه اصلی */}
      {showInline && (
        <div className="w-full px-4 sm:px-6 pt-4 relative z-20">
          <Card className="border-primary/40 bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 shadow-lg max-w-2xl mx-auto">
            <div className="p-4 flex flex-col sm:flex-row items-center gap-3">
              <div className="flex-shrink-0 p-3 rounded-full bg-primary/20 animate-pulse">
                <Phone className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 text-center sm:text-right">
                <h3 className="font-bold text-base text-foreground flex items-center justify-center sm:justify-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  اعلان‌ها را فعال کنید!
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  بدون فعال‌سازی، تماس‌های مدیران و وضعیت سفارشات را دریافت نخواهید کرد
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleEnable}
                  size="sm"
                  className="whitespace-nowrap"
                  disabled={enabling}
                >
                  {enabling ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin ml-1" />
                      در حال فعال‌سازی...
                    </>
                  ) : (
                    <>
                      <Bell className="h-4 w-4 ml-1" />
                      فعال‌سازی
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleDismiss}
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  disabled={enabling}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* دیالوگ اصلی برای فعال‌سازی - مهم‌تر و برجسته‌تر */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center justify-center mb-4">
              <div className="p-4 rounded-full bg-primary/10 animate-pulse">
                <Phone className="h-10 w-10 text-primary" />
              </div>
            </div>
            <DialogTitle className="text-center text-xl">
              فعال‌سازی اعلان تماس‌ها
            </DialogTitle>
            <DialogDescription className="text-center space-y-3 pt-2">
              <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  بدون فعال‌سازی اعلان‌ها، تماس‌های مدیران را دریافت نمی‌کنید!
                </p>
              </div>
              <p className="text-muted-foreground">
                با فعال‌سازی اعلان‌ها، حتی زمانی که سایت بسته است از تماس‌های مدیران و وضعیت سفارشات مطلع می‌شوید.
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button 
              onClick={handleEnable} 
              className="w-full"
              size="lg"
              disabled={enabling}
            >
              {enabling ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin ml-2" />
                  در حال فعال‌سازی...
                </>
              ) : (
                <>
                  <Bell className="h-5 w-5 ml-2" />
                  فعال‌سازی اعلان‌ها
                </>
              )}
            </Button>
            <Button 
              variant="ghost" 
              onClick={() => setShowDialog(false)}
              className="w-full text-muted-foreground"
              disabled={enabling}
            >
              بعداً یادآوری کن
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* بنر floating پایین صفحه - فقط برای variant floating */}
      {variant === 'floating' && showBanner && !showDialog && (
        <div className="w-full animate-in slide-in-from-bottom-4" data-notification-banner>
          <Card className="border-primary/30 bg-card/95 backdrop-blur-sm shadow-xl">
            <div className="p-4 flex items-center gap-3">
              <div className="flex-shrink-0 p-2 rounded-lg bg-primary/10 animate-pulse">
                <Phone className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm">دریافت تماس‌های مدیران</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  بدون فعال‌سازی، تماس‌ها را دریافت نمی‌کنید!
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
                    ...
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
      )}
    </>
  );
}
