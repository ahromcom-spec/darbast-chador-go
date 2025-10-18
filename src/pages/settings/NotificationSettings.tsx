import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Bell, BellOff, CheckCircle, XCircle, Smartphone, AlertCircle } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { toast } from 'sonner';
import { PageHeader } from '@/components/common/PageHeader';

export default function NotificationSettings() {
  const {
    isSupported,
    permission,
    subscription,
    requestPermission,
    subscribeToPush,
    unsubscribe
  } = usePushNotifications();

  const [loading, setLoading] = useState(false);

  const handleEnableNotifications = async () => {
    setLoading(true);
    try {
      const perm = await requestPermission();
      
      if (perm === 'granted') {
        await subscribeToPush();
        toast.success('اعلان‌ها با موفقیت فعال شد!');
      } else {
        toast.error('لطفاً دسترسی به اعلان‌ها را مجاز کنید');
      }
    } catch (error) {
      console.error('Error enabling notifications:', error);
      toast.error('خطا در فعال‌سازی اعلان‌ها');
    } finally {
      setLoading(false);
    }
  };

  const handleDisableNotifications = async () => {
    setLoading(true);
    try {
      await unsubscribe();
      toast.success('اعلان‌ها غیرفعال شد');
    } catch (error) {
      console.error('Error disabling notifications:', error);
      toast.error('خطا در غیرفعال‌سازی اعلان‌ها');
    } finally {
      setLoading(false);
    }
  };

  const sendTestNotification = () => {
    if (permission === 'granted') {
      new Notification('پیام آزمایشی', {
        body: 'این یک اعلان آزمایشی از سیستم اهرم است',
        icon: '/ahrom-app-icon.png',
        badge: '/ahrom-app-icon.png',
        tag: 'test-notification',
        requireInteraction: false
      });
      toast.success('اعلان آزمایشی ارسال شد!');
    }
  };

  return (
    <div className="container max-w-4xl mx-auto px-4 py-6 space-y-6">
      <PageHeader
        title="تنظیمات اعلان‌ها"
        description="مدیریت اعلان‌های پوش برنامه"
        showBackButton
      />

      {/* Support Check */}
      <Card className={!isSupported ? 'border-destructive' : ''}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            <CardTitle>وضعیت پشتیبانی</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {isSupported ? (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              <span>دستگاه شما از اعلان‌های پوش پشتیبانی می‌کند</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              <span>دستگاه شما از اعلان‌های پوش پشتیبانی نمی‌کند</span>
            </div>
          )}
          <p className="text-sm text-muted-foreground mt-2">
            {isSupported 
              ? 'می‌توانید اعلان‌ها را فعال کنید تا از به‌روزرسانی‌های مهم مطلع شوید'
              : 'لطفاً از مرورگر Chrome، Firefox، Edge یا Safari استفاده کنید'}
          </p>
        </CardContent>
      </Card>

      {/* Permission Status */}
      {isSupported && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              <CardTitle>وضعیت دسترسی</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    {permission === 'granted' && 'دسترسی داده شده ✓'}
                    {permission === 'denied' && 'دسترسی رد شده ✗'}
                    {permission === 'default' && 'دسترسی درخواست نشده'}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {permission === 'granted' && 'اعلان‌ها فعال هستند و می‌توانید اعلان دریافت کنید'}
                    {permission === 'denied' && 'برای دریافت اعلان، باید از تنظیمات مرورگر دسترسی را مجاز کنید'}
                    {permission === 'default' && 'هنوز درخواست دسترسی به اعلان‌ها نداده‌اید'}
                  </p>
                </div>
                {permission === 'granted' ? (
                  <CheckCircle className="h-8 w-8 text-green-600" />
                ) : permission === 'denied' ? (
                  <XCircle className="h-8 w-8 text-destructive" />
                ) : (
                  <AlertCircle className="h-8 w-8 text-yellow-600" />
                )}
              </div>

              {permission !== 'granted' && (
                <Button
                  onClick={handleEnableNotifications}
                  disabled={loading || permission === 'denied'}
                  className="w-full"
                  size="lg"
                >
                  <Bell className="h-4 w-4 mr-2" />
                  {permission === 'denied' ? 'دسترسی رد شده' : 'فعال‌سازی اعلان‌ها'}
                </Button>
              )}

              {permission === 'granted' && subscription && (
                <div className="space-y-3">
                  <Button
                    onClick={sendTestNotification}
                    variant="outline"
                    className="w-full"
                  >
                    <Bell className="h-4 w-4 mr-2" />
                    ارسال اعلان آزمایشی
                  </Button>
                  <Button
                    onClick={handleDisableNotifications}
                    disabled={loading}
                    variant="destructive"
                    className="w-full"
                  >
                    <BellOff className="h-4 w-4 mr-2" />
                    غیرفعال‌سازی اعلان‌ها
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card className="bg-primary/5 border-primary/20">
        <CardHeader>
          <CardTitle className="text-lg">💡 راهنمای اعلان‌ها</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-start gap-2">
            <span className="text-primary">•</span>
            <p>اعلان‌های پوش به شما کمک می‌کند تا از سفارشات جدید، تغییر وضعیت سفارشات و پیام‌های مهم بلافاصله مطلع شوید</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-primary">•</span>
            <p>حتی اگر برنامه بسته باشد، همچنان اعلان دریافت خواهید کرد</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-primary">•</span>
            <p>در دستگاه‌های اندروید، اعلان‌ها کاملاً کار می‌کنند. در iOS، ابتدا باید برنامه را به صفحه اصلی اضافه کنید</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-primary">•</span>
            <p>می‌توانید هر زمان که بخواهید اعلان‌ها را غیرفعال کنید</p>
          </div>
        </CardContent>
      </Card>

      {/* Android-specific note */}
      <Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Smartphone className="h-4 w-4" />
            نکته برای کاربران اندروید
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            برای بهترین تجربه، برنامه را از منوی مرورگر "افزودن به صفحه اصلی" کنید.
            سپس برنامه مانند یک اپلیکیشن واقعی روی گوشی شما نصب می‌شود و اعلان‌ها کاملاً کار خواهند کرد.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
