import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Smartphone, CheckCircle, Download, Share, Home } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { useEffect, useState } from 'react';

export default function InstallApp() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    // Detect platform
    const userAgent = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));
    setIsAndroid(/android/.test(userAgent));

    // Capture install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setIsInstalled(true);
    }

    setDeferredPrompt(null);
  };

  return (
    <div className="container max-w-4xl mx-auto px-4 py-6 space-y-6">
      <PageHeader
        title="نصب برنامه"
        description="برنامه اهرم را روی گوشی خود نصب کنید"
        showBackButton
      />

      {isInstalled ? (
        <Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">برنامه نصب شده است! ✓</h3>
            <p className="text-muted-foreground">
              شما در حال استفاده از نسخه نصب شده برنامه هستید
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Android Installation */}
          {isAndroid && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5 text-green-600" />
                  <CardTitle>نصب روی اندروید</CardTitle>
                </div>
                <CardDescription>
                  برنامه را به صورت اپلیکیشن روی گوشی خود نصب کنید
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {deferredPrompt ? (
                  <Button
                    onClick={handleInstallClick}
                    size="lg"
                    className="w-full"
                  >
                    <Download className="h-5 w-5 mr-2" />
                    نصب برنامه
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      برای نصب برنامه، مراحل زیر را دنبال کنید:
                    </p>
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

          {/* iOS Installation */}
          {isIOS && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5 text-blue-600" />
                  <CardTitle>نصب روی آیفون/آیپد</CardTitle>
                </div>
                <CardDescription>
                  برنامه را به صفحه اصلی خود اضافه کنید
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    برای نصب برنامه در Safari، مراحل زیر را دنبال کنید:
                  </p>
                  <ol className="space-y-3 text-sm pr-5">
                    <li className="flex items-start gap-2">
                      <span>۱.</span>
                      <span>
                        روی دکمه اشتراک‌گذاری 
                        <Share className="inline h-4 w-4 mx-1" />
                        در پایین صفحه کلیک کنید
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span>۲.</span>
                      <span>
                        به پایین اسکرول کنید و روی "Add to Home Screen"
                        <Home className="inline h-4 w-4 mx-1" />
                        کلیک کنید
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span>۳.</span>
                      <span>روی "Add" کلیک کنید</span>
                    </li>
                  </ol>
                  <p className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950 p-3 rounded-lg">
                    💡 توجه: این قابلیت فقط در مرورگر Safari در دسترس است
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* General Desktop */}
          {!isIOS && !isAndroid && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5" />
                  <CardTitle>نصب برنامه</CardTitle>
                </div>
                <CardDescription>
                  برنامه را روی دستگاه خود نصب کنید
                </CardDescription>
              </CardHeader>
              <CardContent>
                {deferredPrompt ? (
                  <Button
                    onClick={handleInstallClick}
                    size="lg"
                    className="w-full"
                  >
                    <Download className="h-5 w-5 mr-2" />
                    نصب برنامه
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    برای نصب برنامه، از منوی مرورگر گزینه "Install app" یا "افزودن به صفحه اصلی" را انتخاب کنید.
                  </p>
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
            <p>دسترسی سریع از صفحه اصلی گوشی</p>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <p>کار کردن آفلاین و بارگذاری سریع‌تر</p>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <p>دریافت اعلان‌های فوری (در اندروید)</p>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <p>تجربه کاربری مشابه اپلیکیشن‌های بومی</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
