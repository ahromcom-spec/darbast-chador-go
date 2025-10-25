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
import { Home } from 'lucide-react';
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

  // Web OTP API: auto-read SMS and autofill/submit the code on supported browsers
  useEffect(() => {
    // @ts-ignore - OTPCredential is not in TS lib yet
    if (step !== 'otp' || !('OTPCredential' in window) || typeof navigator.credentials?.get !== 'function') return;
    // @ts-ignore
    const ac = new AbortController();
    const options: any = { otp: { transport: ['sms'] }, signal: ac.signal };
    (navigator as any).credentials.get(options).then((cred: any) => {
      const code = cred?.code || '';
      if (code && code.length === 5) {
        setOtpCode(code);
        (async () => {
          setLoading(true);
          const { error } = await verifyOTP(phoneNumber, code, undefined, false);
          setLoading(false);
          if (error) {
            const errorMessage = error.message || 'کد تایید نامعتبر است.';
            setErrors({ otp: errorMessage });
          } else {
            toast({ title: 'خوش آمدید', description: 'با موفقیت وارد شدید.' });
            navigate(from, { replace: true });
          }
        })();
      }
    }).catch(() => {
      // ignore (user denied or timeout)
    });
    return () => ac.abort();
  }, [step, phoneNumber]);

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

    const { error, userExists } = await sendOTP(phoneNumber, false);
    
    setLoading(false);

    if (error) {
      const errorMessage = error.message || 'خطا در ارسال کد تایید';
      
      // If user doesn't exist, show registration prompt
      if (errorMessage.includes('ثبت نشده') || userExists === false) {
        setStep('not-registered');
        return;
      }
      
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: errorMessage,
      });
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
    const { error } = await sendOTP(phoneNumber, false);
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
      // If backend says number is not registered, guide user to registration step
      if (errorMessage.includes('ثبت نشده')) {
        setStep('not-registered');
        return;
      }
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

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5"
    >
      <div className="w-full max-w-md">
        <Card className="shadow-xl border-border">
          <CardHeader className="text-center space-y-2 pb-4">
            <CardTitle className="text-3xl font-bold">ورود به سامانه</CardTitle>
            <CardDescription className="text-base">
              {step === 'phone' 
                ? 'شماره موبایل خود را وارد کنید' 
                : step === 'not-registered'
                ? 'حساب کاربری یافت نشد'
                : 'کد تایید ارسال شده را وارد کنید'}
            </CardDescription>
          </CardHeader>

          {step === 'not-registered' ? (
            <>
              <CardContent className="space-y-4 px-6">
                <Alert variant="destructive">
                  <AlertDescription className="text-center">
                    شماره موبایل <span className="font-bold">{phoneNumber}</span> در سامانه ثبت نشده است.
                    <br />
                    لطفا ابتدا ثبت‌نام کنید.
                  </AlertDescription>
                </Alert>
              </CardContent>
              <CardFooter className="flex flex-col space-y-3 px-6 pt-4">
                <Button 
                  asChild
                  className="w-full"
                  size="lg"
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
                    بازگشت به صفحه اصلی
                  </Link>
                </Button>
              </CardFooter>
            </>
          ) : step === 'phone' ? (
            <form onSubmit={handleSendOTP}>
              <CardContent className="space-y-4 px-6">
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-base">شماره موبایل</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="09123456789"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    maxLength={11}
                    dir="ltr"
                    className={`h-12 text-lg text-center ${errors.phone ? 'border-destructive' : ''}`}
                    autoFocus
                  />
                  {errors.phone && (
                    <p className="text-sm text-destructive text-center">{errors.phone}</p>
                  )}
                </div>
              </CardContent>
              <CardFooter className="flex flex-col space-y-3 px-6 pt-4">
                <Button 
                  type="submit" 
                  className="w-full" 
                  size="lg"
                  disabled={loading}
                >
                  {loading ? 'در حال ارسال...' : 'ارسال کد تایید'}
                </Button>
                <div className="relative w-full">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-card px-2 text-muted-foreground">یا</span>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  asChild
                >
                  <Link to="/auth/register">
                    ثبت‌نام در سامانه
                  </Link>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  asChild
                >
                  <Link to="/">
                    <Home className="ml-2 h-4 w-4" />
                    بازگشت به صفحه اصلی
                  </Link>
                </Button>
              </CardFooter>
            </form>
          ) : (
            <form onSubmit={handleVerifyOTP}>
              <CardContent className="space-y-6 px-6">
                <div className="space-y-4">
                  <Label className="text-base text-center block">کد تایید 5 رقمی</Label>
                  <div className="flex justify-center" dir="ltr">
                    <InputOTP
                      maxLength={5}
                      value={otpCode}
                      onChange={(value) => setOtpCode(value)}
                      inputMode="numeric"
                      autoFocus
                    >
                      <InputOTPGroup className="gap-2">
                        <InputOTPSlot index={0} className="w-12 h-14 text-xl" />
                        <InputOTPSlot index={1} className="w-12 h-14 text-xl" />
                        <InputOTPSlot index={2} className="w-12 h-14 text-xl" />
                        <InputOTPSlot index={3} className="w-12 h-14 text-xl" />
                        <InputOTPSlot index={4} className="w-12 h-14 text-xl" />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  
                  <div className="text-center space-y-2">
                    <p className="text-sm text-muted-foreground">
                      کد به شماره <span className="font-bold text-foreground" dir="ltr">{phoneNumber}</span> ارسال شد
                    </p>
                    {countdown > 0 ? (
                      <p className="text-sm text-muted-foreground">
                        زمان باقی‌مانده: <span className="font-bold text-primary">{countdown}</span> ثانیه
                      </p>
                    ) : (
                      <Alert variant="destructive">
                        <AlertDescription className="text-center text-sm">
                          کد تایید منقضی شده است. لطفا مجدداً درخواست کنید.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                  
                  {errors.otp && (
                    <Alert variant="destructive">
                      <AlertDescription className="text-center">{errors.otp}</AlertDescription>
                    </Alert>
                  )}
                </div>
              </CardContent>
              <CardFooter className="flex flex-col space-y-3 px-6 pt-4">
                <Button 
                  type="submit" 
                  className="w-full" 
                  size="lg"
                  disabled={loading || countdown === 0 || otpCode.length !== 5}
                >
                  {loading ? 'در حال بررسی...' : 'تایید و ورود'}
                </Button>
                
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleResendOTP}
                  disabled={loading || countdown > 0}
                >
                  {countdown > 0 
                    ? `ارسال مجدد (${countdown}s)` 
                    : loading 
                    ? 'در حال ارسال...' 
                    : 'ارسال مجدد کد'}
                </Button>
                
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={handleBackToPhone}
                  disabled={loading}
                >
                  تغییر شماره موبایل
                </Button>
                
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  asChild
                >
                  <Link to="/">
                    <Home className="ml-2 h-4 w-4" />
                    بازگشت به صفحه اصلی
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