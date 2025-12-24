import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Smartphone, CheckCircle, Download, Share, Home, Monitor } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { useEffect, useMemo, useState } from 'react';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { useToast } from '@/hooks/use-toast';

export default function InstallApp() {
  const { canInstall, isStandalone, isIOS, promptInstall } = usePWAInstall();
  const { toast } = useToast();

  const [isAndroid, setIsAndroid] = useState(false);
  const [isFirefox, setIsFirefox] = useState(false);

  useEffect(() => {
    const userAgent = window.navigator.userAgent.toLowerCase();
    setIsAndroid(userAgent.includes('android'));
    setIsFirefox(userAgent.includes('firefox'));
  }, []);

  const isInstalled = isStandalone;
  const isDesktop = useMemo(() => !isIOS && !isAndroid, [isIOS, isAndroid]);

  const handleInstallClick = async () => {
    const { outcome } = await promptInstall();

    if (outcome === 'accepted') {
      toast({
        title: 'در حال نصب…',
        description: 'اگر پنجره نصب نمایش داده شد، روی گزینه Install/نصب بزنید.'
      });
      return;
    }

    toast({
      title: 'نصب انجام نشد',
      description:
        'اگر پنجره نصب نمایش داده نمی‌شود، از منوی مرورگر گزینه Install app یا Add to Home Screen را انتخاب کنید.'
    });
  };

  return (
    <div className="container max-w-4xl mx-auto px-4 py-6 space-y-6">
      <PageHeader
        title="نصب برنامه"
        description="برنامه اهرم را روی گوشی یا ویندوز نصب کنید"
        showBackButton
      />

      {isInstalled ? (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="h-16 w-16 text-primary mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">برنامه نصب شده است</h3>
            <p className="text-muted-foreground">شما در حال استفاده از نسخه نصب‌شده هستید.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Android */}
          {isAndroid && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5 text-primary" />
                  <CardTitle>نصب روی اندروید</CardTitle>
                </div>
                <CardDescription>برنامه را به صورت اپلیکیشن روی گوشی نصب کنید</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {canInstall ? (
                  <Button onClick={handleInstallClick} size="lg" className="w-full">
                    <Download className="h-5 w-5 ml-2" />
                    نصب برنامه
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">برای نصب، مراحل زیر را دنبال کنید:</p>
                    <ol className="space-y-2 text-sm pr-5">
                      <li>۱. روی منوی مرورگر (سه نقطه) کلیک کنید</li>
                      <li>۲. گزینه "افزودن به صفحه اصلی" یا "Install app" را انتخاب کنید</li>
                      <li>۳. روی "نصب" یا "Add" کلیک کنید</li>
                    </ol>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* iOS */}
          {isIOS && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5 text-primary" />
                  <CardTitle>نصب روی آیفون/آیپد</CardTitle>
                </div>
                <CardDescription>این قابلیت فقط در مرورگر Safari در دسترس است</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">برای نصب برنامه در Safari:</p>
                  <ol className="space-y-3 text-sm pr-5">
                    <li className="flex items-start gap-2">
                      <span>۱.</span>
                      <span>
                        روی دکمه اشتراک‌گذاری
                        <Share className="inline h-4 w-4 mx-1" />
                        بزنید
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span>۲.</span>
                      <span>
                        گزینه "Add to Home Screen"
                        <Home className="inline h-4 w-4 mx-1" />
                        را انتخاب کنید
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span>۳.</span>
                      <span>روی "Add" بزنید</span>
                    </li>
                  </ol>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Desktop */}
          {isDesktop && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Monitor className="h-5 w-5 text-primary" />
                  <CardTitle>نصب روی ویندوز</CardTitle>
                </div>
                <CardDescription>بهترین گزینه: مرورگر Chrome یا Edge</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {isFirefox ? (
                  <p className="text-sm text-muted-foreground">
                    مرورگر Firefox در ویندوز نصب مستقیم برنامه (PWA) را پشتیبانی نمی‌کند. لطفاً با Chrome یا Edge امتحان کنید.
                  </p>
                ) : canInstall ? (
                  <Button onClick={handleInstallClick} size="lg" className="w-full">
                    <Download className="h-5 w-5 ml-2" />
                    نصب برنامه
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      اگر آیکون نصب در نوار آدرس نمایش داده می‌شود، روی آن بزنید (یا از منوی مرورگر گزینه Install app را انتخاب کنید).
                    </p>
                    <p className="text-xs text-muted-foreground">
                      نکته: اگر قبلاً نصب را رد کرده باشید، ممکن است تا مدتی دکمه نصب نمایش داده نشود.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Benefits */}
      <Card className="bg-primary/5 border-primary/20">
        <CardHeader>
          <CardTitle>مزایای نصب برنامه</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-start gap-2">
            <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <p>دسترسی سریع از دسکتاپ یا صفحه اصلی گوشی</p>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <p>بارگذاری سریع‌تر و تجربه مشابه اپلیکیشن</p>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <p>کارکرد بهتر در شرایط اینترنت ضعیف</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
