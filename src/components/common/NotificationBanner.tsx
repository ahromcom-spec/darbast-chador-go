import { Bell, X, Loader2, Phone, AlertTriangle, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useOneSignal } from '@/hooks/useOneSignal';
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
  const [showBanner, setShowBanner] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [showDeniedHelp, setShowDeniedHelp] = useState(false);
  const location = useLocation();
  const { permission, isSupported, isSubscribed, subscribe, isInitialized } = useOneSignal();
  const { toast } = useToast();

  // بررسی اگر کاربر هنوز اعلان ندارد - نمایش دیالوگ
  useEffect(() => {
    if (!user || !isSupported || isSubscribed) {
      setShowBanner(false);
      setShowDialog(false);
      return;
    }

    // اگر permission denied است، نشان دادن راهنما
    if (permission === 'denied') {
      setShowDeniedHelp(true);
    }

    // اگر اولین بار است یا مدت زیادی گذشته، دیالوگ نشان بده
    const hasSeenDialog = localStorage.getItem('notification-dialog-seen');
    const dialogTimestamp = hasSeenDialog ? parseInt(hasSeenDialog) : 0;
    const hoursSinceDialog = (Date.now() - dialogTimestamp) / (1000 * 60 * 60);

    // نمایش دیالوگ هر 12 ساعت تا کاربر فعال کند
    if (!isSubscribed && hoursSinceDialog > 12) {
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
  }, [user, isSupported, permission, dismissed, isSubscribed]);

  const handleDismiss = () => {
    setDismissed(true);
    setShowBanner(false);
    localStorage.setItem(DISMISSAL_KEY, JSON.stringify({
      timestamp: Date.now()
    }));
  };

  const handleEnable = async () => {
    setEnabling(true);
    
    // Timeout کوتاه‌تر چون حالا از Native API استفاده می‌کنیم
    const timeoutId = setTimeout(() => {
      setEnabling(false);
      toast({
        title: '❌ خطا',
        description: 'لطفاً صفحه را رفرش کرده و دوباره تلاش کنید.',
        variant: 'destructive'
      });
    }, 15000);
    
    try {
      console.log('🔔 Starting notification enablement...');
      
      if (!user) {
        clearTimeout(timeoutId);
        throw new Error('not authenticated');
      }
      
      const result = await subscribe();
      clearTimeout(timeoutId);
      console.log('🔔 Subscribe result:', result);
      
      if (result) {
        toast({
          title: '✅ اعلان‌ها فعال شد',
          description: 'از این پس تماس‌های ورودی و به‌روزرسانی سفارشات را دریافت خواهید کرد',
        });
        setDismissed(true);
        setShowBanner(false);
        setShowDialog(false);
        setShowDeniedHelp(false);
      } else {
        setShowDeniedHelp(true);
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
        variant: 'destructive'
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

  // نمایش inline بنر در بالای صفحه
  const showInline = variant === 'inline' && user && isSupported && !isSubscribed && permission !== 'granted' && !dismissed;

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

      {/* دیالوگ اصلی برای فعال‌سازی */}
      <Dialog open={showDialog} onOpenChange={(open) => {
        setShowDialog(open);
        if (!open) setShowDeniedHelp(false);
      }}>
        <DialogContent className="max-w-md border-primary/30 bg-gradient-to-br from-background via-background to-primary/5 shadow-2xl">
          <DialogHeader>
            <div className="flex items-center justify-center mb-4">
              <div className={`p-4 rounded-full shadow-lg ${showDeniedHelp ? 'bg-destructive/20 border border-destructive/30' : 'bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/30 animate-pulse'}`}>
                {showDeniedHelp ? (
                  <Settings className="h-10 w-10 text-destructive" />
                ) : (
                  <Bell className="h-10 w-10 text-primary" />
                )}
              </div>
            </div>
            <DialogTitle className="text-center text-xl font-bold text-foreground">
              {showDeniedHelp ? 'دسترسی رد شده است' : 'پیام های سایت'}
            </DialogTitle>
            <DialogDescription className="text-center space-y-4 pt-3">
              {showDeniedHelp ? (
                <>
                  <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-xl border border-destructive/30">
                    <X className="h-5 w-5 text-destructive flex-shrink-0" />
                    <p className="text-sm text-destructive">
                      دسترسی اعلان در مرورگر مسدود شده است
                    </p>
                  </div>
                  <div className="text-right space-y-2 bg-muted/30 p-4 rounded-xl border border-border/50">
                    <p className="font-medium text-foreground text-sm">برای فعال‌سازی:</p>
                    <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                      <li>روی آیکون قفل کنار آدرس سایت کلیک کنید</li>
                      <li>گزینه "اعلان‌ها" یا "Notifications" را پیدا کنید</li>
                      <li>آن را از "مسدود" به "اجازه" تغییر دهید</li>
                      <li>صفحه را رفرش کنید</li>
                    </ol>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    یا می‌توانید به صفحه تنظیمات اعلان‌ها بروید:
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground text-base">
                  می‌خواهید از مراحل سفارش و پیام ها آگاه باشید؟
                </p>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-3 sm:flex-col pt-2">
            {showDeniedHelp ? (
              <>
                <Button 
                  onClick={handleGoToSettings}
                  className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg"
                  size="lg"
                >
                  <Settings className="h-5 w-5 ml-2" />
                  رفتن به تنظیمات اعلان‌ها
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setShowDeniedHelp(false)}
                  className="w-full border-primary/30 hover:bg-primary/5"
                >
                  تلاش مجدد
                </Button>
              </>
            ) : (
              <>
                <Button 
                  onClick={handleEnable} 
                  className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg text-primary-foreground font-bold py-6"
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
                <Button 
                  variant="ghost" 
                  onClick={() => setShowDialog(false)}
                  className="w-full text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  disabled={enabling}
                >
                  بعداً یادآوری کن
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* بنر floating پایین صفحه */}
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
