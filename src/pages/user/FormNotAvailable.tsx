import { useNavigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowRight, Construction, Clock } from 'lucide-react';

export default function FormNotAvailable() {
  const navigate = useNavigate();
  const location = useLocation();
  
  const state = location.state || {};
  const {
    serviceName = 'خدمات',
    subcategoryName = '',
    subcategoryCode = '',
    locationAddress,
    provinceName,
    districtName
  } = state;

  // این صفحه دیگر نیازی به redirect ندارد چون همه فرم‌ها از SelectLocation هدایت می‌شوند
  useEffect(() => {
    // اگر به اشتباه کاربر به این صفحه آمد، به صفحه اصلی برود
    if (!serviceName || !subcategoryName) {
      navigate('/');
    }
  }, [serviceName, subcategoryName, navigate]);

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      {/* Hero Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ 
          backgroundImage: 'url(/hero-background.webp)',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/60" />
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto py-6 px-4 max-w-4xl">
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="mb-4 text-white hover:bg-white/10"
        >
          <ArrowRight className="w-4 h-4 ml-2" />
          بازگشت به صفحه اصلی
        </Button>

        <div className="mt-6">
          <Card className="shadow-2xl bg-card/95 backdrop-blur-md border-2">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <Construction className="w-8 h-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">
                {serviceName}
                {subcategoryName && ` - ${subcategoryName}`}
              </CardTitle>
              <CardDescription className="text-base mt-2">
                {locationAddress && (
                  <span className="block">
                    آدرس: {provinceName && `${provinceName} - `}
                    {districtName && `${districtName} - `}
                    {locationAddress}
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-6">
              <Alert className="border-amber-500/50 bg-amber-500/10">
                <Clock className="h-5 w-5 text-amber-500" />
                <AlertDescription className="text-base text-foreground mt-1">
                  <strong className="block mb-2">فرم خدمات هنوز جایگزاری نشده است</strong>
                  <p className="text-sm text-muted-foreground">
                    فرم ثبت سفارش برای این خدمت در حال توسعه است و به زودی در دسترس خواهد بود.
                  </p>
                </AlertDescription>
              </Alert>

              <div className="bg-muted/50 rounded-lg p-6 space-y-4">
                <h3 className="font-semibold text-lg">برای ثبت سفارش این خدمت:</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>می‌توانید با شماره پشتیبانی تماس بگیرید</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>یا منتظر راه‌اندازی فرم آنلاین این خدمت بمانید</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>در صورت نیاز فوری، از طریق بخش تیکت‌ها درخواست خود را ثبت کنید</span>
                  </li>
                </ul>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={() => navigate('/')}
                  variant="default"
                  className="flex-1"
                >
                  <ArrowRight className="w-4 h-4 ml-2" />
                  انتخاب خدمت دیگر
                </Button>
                <Button
                  onClick={() => navigate('/tickets/new')}
                  variant="outline"
                  className="flex-1"
                >
                  ثبت تیکت پشتیبانی
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
