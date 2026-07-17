import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bell, BellOff, Smartphone, Info, CheckCircle2, AlertCircle, Send } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { useOneSignal } from '@/hooks/useOneSignal';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function NotificationSettings() {
  const { user } = useAuth();
  const { isSupported, isInitialized, isSubscribed, subscriptionId, permission, loading, subscribe, unsubscribe } = useOneSignal();
  const [testing, setTesting] = useState(false);
  const [lastTest, setLastTest] = useState<{ trackId: string; result: any; at: string } | null>(null);

  const handleTest = async () => {
    setTesting(true);
    const trackId = `TEST-${Date.now().toString(36).toUpperCase()}`;
    try {
      const { data, error } = await supabase.functions.invoke('send-onesignal-push', {
        body: {
          title: `🔔 تست اعلان ${trackId}`,
          body: `این یک اعلان آزمایشی است. کد ردیابی: ${trackId} — اگر روی مرورگر/موبایل دیدید، روی آن کلیک کنید.`,
          url: '/activity-logs',
          phone: '09125511494',
        },
      });
      const result = error ? { error: error.message, data } : data;
      setLastTest({ trackId, result, at: new Date().toLocaleString('fa-IR') });
      if (error) toast.error('ارسال ناموفق — جزئیات پایین کارت تست');
      else if (result?.onesignal?.id) toast.success(`ارسال شد ✅ id: ${result.onesignal.id.slice(0, 8)}…`);
      else toast.warning('پاسخ دریافت شد ولی شناسه‌ای از OneSignal نیامد — جزئیات را ببینید');
    } catch (e: any) {
      setLastTest({ trackId, result: { error: e?.message || String(e) }, at: new Date().toLocaleString('fa-IR') });
      toast.error('خطا در ارسال تست');
    } finally {
      setTesting(false);
    }
  };


  const handleSubscribe = async () => {
    try {
      const ok = await subscribe();
      if (ok) toast.success('اعلان‌ها فعال شد ✅');
      else toast.error('فعال‌سازی انجام نشد. لطفاً اجازه مرورگر را بررسی کنید.');
    } catch (e: any) {
      toast.error(e?.message || 'خطا در فعال‌سازی اعلان');
    }
  };

  const handleUnsubscribe = async () => {
    try {
      await unsubscribe();
      toast.success('اعلان‌ها غیرفعال شد');
    } catch (e: any) {
      toast.error(e?.message || 'خطا در غیرفعال‌سازی');
    }
  };

  return (
    <div className="container max-w-4xl mx-auto px-4 py-6 space-y-6">
      <PageHeader
        title="تنظیمات اعلان‌ها"
        description="مدیریت اعلان‌های پوش مرورگر"
        showBackButton
      />

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            <CardTitle>اعلان‌های مرورگر (OneSignal)</CardTitle>
          </div>
          <CardDescription>
            با فعال‌سازی، اعلان سفارش‌ها و رویدادهای مهم را در همین مرورگر دریافت می‌کنید.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!user && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4" /> برای فعال‌سازی ابتدا وارد حساب کاربری شوید.
            </div>
          )}

          {!isSupported && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" /> مرورگر شما از اعلان پوش پشتیبانی نمی‌کند.
            </div>
          )}

          {isSupported && (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="text-muted-foreground">وضعیت:</span>
              {isSubscribed && permission === 'granted' ? (
                <span className="flex items-center gap-1 text-green-600 font-medium">
                  <CheckCircle2 className="h-4 w-4" /> فعال
                </span>
              ) : permission === 'denied' ? (
                <span className="flex items-center gap-1 text-destructive font-medium">
                  <BellOff className="h-4 w-4" /> مسدودشده توسط مرورگر
                </span>
              ) : (
                <span className="text-muted-foreground">غیرفعال</span>
              )}
            </div>
          )}

          {isSupported && user && (
            <div className="flex gap-2">
              {!isSubscribed ? (
                <Button onClick={handleSubscribe} disabled={loading || permission === 'denied'}>
                  <Bell className="h-4 w-4 ml-2" />
                  {loading ? 'در حال فعال‌سازی...' : 'فعال‌سازی اعلان‌ها'}
                </Button>
              ) : (
                <Button variant="outline" onClick={handleUnsubscribe} disabled={loading}>
                  <BellOff className="h-4 w-4 ml-2" />
                  {loading ? 'در حال غیرفعال‌سازی...' : 'غیرفعال‌سازی'}
                </Button>
              )}
            </div>
          )}

          {permission === 'denied' && (
            <p className="text-xs text-muted-foreground">
              برای رفع مسدودی: روی آیکن قفل کنار آدرس سایت در مرورگر کلیک کنید و اجازه Notifications را روی Allow بگذارید.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            <CardTitle>تست اعلان (مرورگر و موبایل)</CardTitle>
          </div>
          <CardDescription>
            یک اعلان آزمایشی با کد ردیابی به مدیرعامل (۰۹۱۲۵۵۱۱۴۹۴) می‌فرستد. پاسخ OneSignal و
            شناسه ارسال در همین کارت نمایش داده می‌شود تا قابل پیگیری باشد.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="p-2 rounded border bg-muted/30">
              <span className="text-muted-foreground">وضعیت اشتراک: </span>
              <span className="font-medium">{isSubscribed ? 'فعال' : 'غیرفعال'}</span>
            </div>
            <div className="p-2 rounded border bg-muted/30 truncate" title={subscriptionId || ''}>
              <span className="text-muted-foreground">Subscription ID: </span>
              <span className="font-mono">{subscriptionId ? subscriptionId.slice(0, 16) + '…' : '—'}</span>
            </div>
            <div className="p-2 rounded border bg-muted/30 truncate" title={user?.id || ''}>
              <span className="text-muted-foreground">External ID (user): </span>
              <span className="font-mono">{user?.id ? user.id.slice(0, 16) + '…' : '—'}</span>
            </div>
            <div className="p-2 rounded border bg-muted/30">
              <span className="text-muted-foreground">SDK init: </span>
              <span className="font-medium">{isInitialized ? 'OK' : '...'}</span>
            </div>
          </div>

          <Button onClick={handleTest} disabled={testing}>
            <Send className="h-4 w-4 ml-2" />
            {testing ? 'در حال ارسال...' : 'ارسال اعلان تست به مدیرعامل'}
          </Button>

          {lastTest && (
            <div className="rounded border p-3 bg-muted/20 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium">کد ردیابی: {lastTest.trackId}</span>
                <span className="text-muted-foreground">{lastTest.at}</span>
              </div>
              <pre dir="ltr" className="text-[10px] leading-4 overflow-auto max-h-48 bg-background p-2 rounded border">
{JSON.stringify(lastTest.result, null, 2)}
              </pre>
              {lastTest.result?.onesignal?.errors && (
                <p className="text-xs text-destructive">
                  ⚠️ خطای OneSignal — معمولاً به این معنی است که هنوز هیچ مرورگری برای این کاربر در OneSignal ثبت
                  نشده. لطفاً ابتدا روی همین دستگاه «فعال‌سازی اعلان‌ها» را بزنید و سپس تست را تکرار کنید.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>



      <Card className="bg-primary/5 border-primary/20">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Info className="h-5 w-5" />
            توضیحات
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-start gap-2">
            <Smartphone className="h-4 w-4 mt-0.5 text-primary" />
            <p>روی موبایل: ابتدا سایت را به صفحه اصلی (Add to Home Screen) اضافه کنید، سپس از داخل همان آیکن وارد شده و اعلان را فعال کنید.</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-primary">•</span>
            <p>برای اعلان نیتیو (بدون مرورگر)، باید نسخه اپلیکیشن با Capacitor + OneSignal SDK ساخته شود.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
