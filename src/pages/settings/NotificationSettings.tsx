import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Bell, BellOff, CheckCircle, XCircle, Smartphone, AlertCircle, Loader2 } from 'lucide-react';
import { useNajvaSubscription } from '@/hooks/useNajvaSubscription';
import { toast } from 'sonner';
import { PageHeader } from '@/components/common/PageHeader';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export default function NotificationSettings() {
  const { user } = useAuth();
  const {
    isSubscribed,
    isLoading,
    subscriberId,
    subscribe,
    unsubscribe
  } = useNajvaSubscription();

  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(true);

  useEffect(() => {
    // بررسی پشتیبانی
    if (!('Notification' in window)) {
      setIsSupported(false);
      return;
    }
    setPermission(Notification.permission);
  }, []);

  const handleEnableNotifications = async () => {
    setLoading(true);
    try {
      const result = await subscribe();
      
      if (result) {
        toast.success('اعلان‌ها با موفقیت فعال شد!');
        setPermission(Notification.permission);
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
        icon: '/icons/icon-512-v3.png',
        badge: '/icons/icon-192-v3.png',
        tag: 'test-notification',
        requireInteraction: false
      });
      toast.success('اعلان آزمایشی (داخل مرورگر) نمایش داده شد.');
    }
  };

  const sendServerTestPush = async () => {
    if (!user) return;

    setTestLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-push-notification', {
        body: {
          user_id: user.id,
          title: '🔔 تست پوش',
          body: 'این یک پوش تستی است. اگر اعلان را می‌بینید یعنی پوش درست کار می‌کند.',
          link: '/settings/notifications',
          type: 'test'
        }
      });

      if (error) throw error;

      if (data?.pushSent) {
        toast.success('پوش تستی ارسال شد ✅');
      } else {
        toast.warning('پوش ارسال نشد (احتمالاً توکن دستگاه ذخیره نشده). ابتدا «فعال‌سازی اعلان‌ها» را بزنید.');
      }
    } catch (e) {
      console.error('Server test push error:', e);
      toast.error('خطا در ارسال پوش تستی');
    } finally {
      setTestLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="container max-w-4xl mx-auto px-4 py-6">
        <PageHeader
          title="تنظیمات اعلان‌ها"
          description="برای استفاده از اعلان‌ها ابتدا وارد شوید"
          showBackButton
        />
        <Card className="mt-6">
          <CardContent className="py-8 text-center text-muted-foreground">
            لطفاً ابتدا وارد حساب کاربری خود شوید
          </CardContent>
        </Card>
      </div>
    );
  }

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
          {isLoading && isSupported && (
            <div className="flex items-center gap-2 mt-3 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">در حال بررسی وضعیت اشتراک...</span>
            </div>
          )}
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
                    {isSubscribed && 'اعلان‌ها فعال ✓'}
                    {!isSubscribed && permission === 'denied' && 'دسترسی رد شده ✗'}
                    {!isSubscribed && permission !== 'denied' && 'اعلان‌ها غیرفعال'}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {isSubscribed && 'اعلان‌ها فعال هستند و می‌توانید اعلان دریافت کنید'}
                    {!isSubscribed && permission === 'denied' && 'برای دریافت اعلان، باید از تنظیمات مرورگر دسترسی را مجاز کنید'}
                    {!isSubscribed && permission !== 'denied' && 'روی دکمه فعال‌سازی کلیک کنید'}
                  </p>
                  {isSubscribed && subscriberId && (
                    <p className="text-xs text-muted-foreground mt-2 font-mono">
                      شناسه: {subscriberId.substring(0, 12)}...
                    </p>
                  )}
                </div>
                {isSubscribed ? (
                  <CheckCircle className="h-8 w-8 text-green-600" />
                ) : permission === 'denied' ? (
                  <XCircle className="h-8 w-8 text-destructive" />
                ) : (
                  <AlertCircle className="h-8 w-8 text-yellow-600" />
                )}
              </div>

              {!isSubscribed && (
                <Button
                  onClick={handleEnableNotifications}
                  disabled={loading || permission === 'denied' || isLoading}
                  className="w-full"
                  size="lg"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      در حال فعال‌سازی...
                    </>
                  ) : (
                    <>
                      <Bell className="h-4 w-4 mr-2" />
                      {permission === 'denied' ? 'دسترسی رد شده' : 'فعال‌سازی اعلان‌ها'}
                    </>
                  )}
                </Button>
              )}

              {isSubscribed && (
                <div className="space-y-3">
                  <Button
                    onClick={sendTestNotification}
                    variant="outline"
                    className="w-full"
                  >
                    <Bell className="h-4 w-4 mr-2" />
                    تست اعلان داخل مرورگر
                  </Button>

                  <Button
                    onClick={sendServerTestPush}
                    variant="outline"
                    disabled={testLoading}
                    className="w-full"
                  >
                    {testLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        در حال ارسال پوش...
                      </>
                    ) : (
                      <>
                        <Bell className="h-4 w-4 mr-2" />
                        تست پوش واقعی (سرور)
                      </>
                    )}
                  </Button>

                  <Button
                    onClick={handleDisableNotifications}
                    disabled={loading}
                    variant="destructive"
                    className="w-full"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        در حال غیرفعال‌سازی...
                      </>
                    ) : (
                      <>
                        <BellOff className="h-4 w-4 mr-2" />
                        غیرفعال‌سازی اعلان‌ها
                      </>
                    )}
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
            <p>اعلان‌های پوش به شما کمک می‌کند تا از تماس‌های ورودی، سفارشات جدید و پیام‌های مهم بلافاصله مطلع شوید</p>
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
