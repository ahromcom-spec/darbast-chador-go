import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Download, X, Home } from 'lucide-react';
import { z } from 'zod';

const phoneSchema = z.object({
  phone: z.string()
    .length(11, { message: 'شماره موبایل باید 11 رقم باشد' })
    .regex(/^09\d{9}$/, { message: 'فرمت صحیح: 09123456789' }),
});

export default function Login() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [step, setStep] = useState<'phone' | 'otp' | 'not-registered'>('phone');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ phone?: string; otp?: string }>({});
  const [countdown, setCountdown] = useState(90);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [userExists, setUserExists] = useState<boolean | null>(null);
  
  const { user, sendOTP, verifyOTP } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/';

  useEffect(() => {
    if (user) {
      navigate(from, { replace: true });
    }
  }, [user, navigate, from]);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (step === 'otp' && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [step, countdown]);

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    try {
      phoneSchema.parse({ phone: phoneNumber });
    } catch (error) {
      if (error instanceof z.ZodError) {
        setErrors({ phone: error.errors[0].message });
        return;
      }
    }

    setLoading(true);

    const { error, userExists: exists } = await sendOTP(phoneNumber);
    
    setLoading(false);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'خطا در ارسال کد تایید. لطفا دوباره تلاش کنید.',
      });
      return;
    }

    setUserExists(exists || false);

    // اگر کاربر وجود ندارد، نمایش پیام عدم ثبت‌نام
    if (!exists) {
      setStep('not-registered');
      return;
    }

    toast({
      title: 'موفق',
      description: 'کد تایید به شماره شما ارسال شد.',
    });
    setCountdown(90);
    setStep('otp');
  };

  const handleResendOTP = async () => {
    setLoading(true);
    const { error } = await sendOTP(phoneNumber);
    setLoading(false);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'خطا در ارسال مجدد کد تایید.',
      });
      return;
    }

    toast({
      title: 'موفق',
      description: 'کد تایید مجدد ارسال شد.',
    });
    setCountdown(90);
    setOtpCode('');
    setErrors({});
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (otpCode.length !== 5) {
      setErrors({ otp: 'کد تایید باید 5 رقم باشد' });
      return;
    }

    setLoading(true);

    const { error } = await verifyOTP(phoneNumber, otpCode, undefined, false);
    
    setLoading(false);

    if (error) {
      const errorMessage = error.message || 'کد تایید نامعتبر است.';
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: errorMessage,
      });
      setErrors({ otp: errorMessage });
      return;
    }

    toast({
      title: 'خوش آمدید',
      description: 'با موفقیت وارد شدید.',
    });

    navigate(from, { replace: true });
  };

  const handleBackToPhone = () => {
    setStep('phone');
    setOtpCode('');
    setErrors({});
    setCountdown(90);
    setUserExists(null);
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      toast({
        title: 'راهنما',
        description: 'برای نصب اپلیکیشن، از منوی مرورگر خود گزینه "نصب" یا "Add to Home Screen" را انتخاب کنید.',
      });
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      toast({
        title: 'موفق',
        description: 'اپلیکیشن با موفقیت نصب شد.',
      });
    }
    
    setDeferredPrompt(null);
    setShowInstallPrompt(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary p-4">
      <div className="w-full max-w-md space-y-4">
        {showInstallPrompt && (
          <Alert className="border-primary bg-primary/5">
            <Download className="h-5 w-5 text-primary" />
            <AlertDescription className="flex items-center justify-between gap-2">
              <span className="text-sm">
                برای دسترسی آسان‌تر، این برنامه را روی گوشی خود نصب کنید
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleInstallClick}
                  className="construction-gradient hover:opacity-90"
                >
                  نصب
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowInstallPrompt(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}
        
        <Card className="shadow-elegant">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-2xl font-bold text-primary">ورود به سامانه</CardTitle>
          <CardDescription>
            {step === 'phone' 
              ? 'شماره موبایل خود را وارد کنید' 
              : step === 'not-registered'
              ? 'حساب کاربری یافت نشد'
              : 'کد تایید ارسال شده را وارد کنید'}
          </CardDescription>
        </CardHeader>
        {step === 'not-registered' ? (
          <>
            <CardContent className="space-y-4">
              <Alert variant="destructive">
                <AlertDescription className="text-center">
                  شماره موبایل <span className="font-bold">{phoneNumber}</span> در سامانه ثبت نشده است.
                  <br />
                  لطفا ابتدا ثبت‌نام کنید.
                </AlertDescription>
              </Alert>
            </CardContent>
            <CardFooter className="flex flex-col space-y-3">
              <Button 
                asChild
                className="w-full construction-gradient hover:opacity-90"
              >
                <Link to="/auth/register" state={{ phone: phoneNumber }}>
                  ثبت‌نام در سامانه
                </Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleBackToPhone}
              >
                تغییر شماره موبایل
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                asChild
              >
                <Link to="/">
                  <Home className="ml-2 h-4 w-4" />
                  بازگشت به صفحه نخست
                </Link>
              </Button>
            </CardFooter>
          </>
        ) : step === 'phone' ? (
          <form onSubmit={handleSendOTP}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">شماره موبایل</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="09123456789"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  maxLength={11}
                  dir="ltr"
                  className={errors.phone ? 'border-destructive' : ''}
                />
                {errors.phone && (
                  <p className="text-sm text-destructive">{errors.phone}</p>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-3">
              <Button 
                type="submit" 
                className="w-full construction-gradient hover:opacity-90" 
                disabled={loading}
              >
                {loading ? 'در حال ارسال...' : 'ارسال کد تایید'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                asChild
              >
                <Link to="/">
                  <Home className="ml-2 h-4 w-4" />
                  بازگشت به صفحه نخست
                </Link>
              </Button>
              <p className="text-sm text-center text-muted-foreground">
                حساب کاربری ندارید؟{' '}
                <Link 
                  to="/auth/register" 
                  className="text-primary hover:text-primary-light font-medium transition-colors"
                >
                  ثبت نام کنید
                </Link>
              </p>
            </CardFooter>
          </form>
        ) : (
          <form onSubmit={handleVerifyOTP}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>کد تایید</Label>
                <div className="flex justify-center" dir="ltr">
                  <InputOTP
                    maxLength={5}
                    value={otpCode}
                    onChange={(value) => setOtpCode(value)}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                {countdown > 0 ? (
                  <p className="text-sm text-center text-muted-foreground">
                    زمان باقی‌مانده: <span className="font-bold text-primary">{countdown}</span> ثانیه
                  </p>
                ) : (
                  <Alert variant="destructive" className="mt-2">
                    <AlertDescription className="text-center">
                      کد تایید منقضی شده است. لطفا مجدداً درخواست کنید.
                    </AlertDescription>
                  </Alert>
                )}
                {errors.otp && (
                  <p className="text-sm text-destructive text-center">{errors.otp}</p>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-3">
              <Button 
                type="submit" 
                className="w-full construction-gradient hover:opacity-90" 
                disabled={loading || countdown === 0}
              >
                {loading ? 'در حال بررسی...' : 'تایید و ورود'}
              </Button>
              {countdown === 0 && (
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  onClick={handleResendOTP}
                  disabled={loading}
                >
                  {loading ? 'در حال ارسال...' : 'ارسال مجدد کد تایید'}
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleBackToPhone}
              >
                تغییر شماره موبایل
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                asChild
              >
                <Link to="/">
                  <Home className="ml-2 h-4 w-4" />
                  بازگشت به صفحه نخست
                </Link>
              </Button>
            </CardFooter>
          </form>
        )}
        </Card>
      </div>
    </div>
  );
}