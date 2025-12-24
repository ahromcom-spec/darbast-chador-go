import { useState, useEffect } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Home, Eye, EyeOff } from 'lucide-react';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';

const phoneSchema = z.object({
  phone: z.string()
    .length(11, { message: 'شماره موبایل باید 11 رقم باشد' })
    .regex(/^09\d{9}$/, { message: 'فرمت صحیح: 09123456789' }),
});

export default function Login() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState<'phone' | 'otp' | 'password' | 'not-registered'>('phone');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ phone?: string; otp?: string; password?: string }>({});
  const [countdown, setCountdown] = useState(90);
  const [userExists, setUserExists] = useState<boolean | null>(null);
  
  const { user, sendOTP, verifyOTP } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  // Don't redirect to form pages that require state data
  const isFormPage = location.state?.from?.pathname?.includes('/form') || 
                     location.state?.from?.pathname?.includes('/scaffolding');
  const from = isFormPage ? '/' : (location.state?.from?.pathname || '/');

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

  // بررسی وجود شماره در لیست سفید
  const checkWhitelist = async (phone: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('phone_whitelist')
        .select('phone_number')
        .eq('phone_number', phone)
        .maybeSingle();
      
      return !!data && !error;
    } catch {
      return false;
    }
  };

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

    // بستن کیبورد
    (document.activeElement as HTMLElement | null)?.blur();
    setLoading(true);

    // بررسی وجود در لیست سفید
    const isWhitelisted = await checkWhitelist(phoneNumber);
    
    if (isWhitelisted) {
      // شماره در لیست سفید است - نمایش فرم رمز عبور
      setLoading(false);
      flushSync(() => {
        setStep('password');
      });
      return;
    }

    // شماره عادی است - ارسال OTP
    flushSync(() => {
      setCountdown(90);
      setStep('otp');
    });

    // ارسال کد تایید (بک‌اند وضعیت ثبت‌نام را مشخص می‌کند)
    const { error, userExists } = await sendOTP(phoneNumber, false);
    
    setLoading(false);

    // اگر کاربر ثبت‌نام نکرده باشد (چه در پاسخ موفق چه خطا)، پیام راهنمای ثبت‌نام نمایش دهیم
    const needsRegistration = userExists === false;

    if (error) {
      const msg = error.message || 'خطا در ارسال کد تایید';
      const isGenericEdgeError = /non-2xx|Edge Function returned/i.test(msg);
      if (needsRegistration || isGenericEdgeError || msg.includes('ثبت نشده')) {
        setStep('not-registered');
        toast({
          title: 'نیاز به ثبت‌نام',
          description: 'برای ورود به اهرم، ابتدا ثبت‌نام کنید.',
        });
        return;
      }
      // برگشت به مرحله شماره در صورت خطا
      setStep('phone');
      toast({ variant: 'destructive', title: 'خطا', description: msg });
      return;
    }

    if (needsRegistration) {
      setStep('not-registered');
      toast({
        title: 'نیاز به ثبت‌نام',
        description: 'برای ورود به اهرم، ابتدا ثبت‌نام کنید.',
      });
      return;
    }

    toast({ title: 'موفق', description: 'کد تایید به شماره شما ارسال شد.' });
  };

const handleResendOTP = async () => {
    setLoading(true);
    const { error, userExists } = await sendOTP(phoneNumber, false);
    setLoading(false);

    if (error) {
      const msg = error.message || 'خطا در ارسال مجدد کد تایید.';
      const isGenericEdgeError = /non-2xx|Edge Function returned/i.test(msg);
      if (userExists === false || isGenericEdgeError || msg.includes('ثبت نشده')) {
        setStep('not-registered');
        toast({ title: 'نیاز به ثبت‌نام', description: 'برای ورود به اهرم، ابتدا ثبت‌نام کنید.' });
        return;
      }
      toast({ variant: 'destructive', title: 'خطا', description: msg });
      return;
    }

    if (userExists === false) {
      setStep('not-registered');
      toast({ title: 'نیاز به ثبت‌نام', description: 'برای ورود به اهرم، ابتدا ثبت‌نام کنید.' });
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
      
      // فقط در صورتی که خطا صریحاً بگوید کاربر ثبت‌نام نشده، به صفحه ثبت‌نام برود
      // خطاهای عمومی یا کد اشتباه نباید کاربر را به ثبت‌نام ببرند
      if (errorMessage.includes('ثبت نشده') && !errorMessage.includes('نامعتبر')) {
        setStep('not-registered');
        toast({ title: 'نیاز به ثبت‌نام', description: 'برای ادامه، لطفاً ثبت‌نام کنید.' });
        return;
      }
      
      // نمایش پیام خطا و ماندن در همین صفحه برای وارد کردن مجدد کد
      toast({
        variant: 'destructive',
        title: 'کد تایید اشتباه است',
        description: 'لطفاً کد تایید را مجدداً وارد کنید.',
      });
      setErrors({ otp: 'کد تایید اشتباه است. لطفاً مجدداً تلاش کنید.' });
      setOtpCode(''); // پاک کردن کد اشتباه برای وارد کردن مجدد
      return;
    }

    toast({
      title: 'خوش آمدید',
      description: 'با موفقیت وارد شدید.',
    });

    navigate(from, { replace: true });
  };

  const handleVerifyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!password) {
      setErrors({ password: 'رمز عبور را وارد کنید' });
      return;
    }

    setLoading(true);

    // استفاده از کانال verify-otp با رمز عبور به جای کد OTP
    const { data, error } = await supabase.functions.invoke('verify-otp', {
      body: { 
        phone_number: phoneNumber,
        code: password,
        is_password_login: true
      }
    });
    
    setLoading(false);

    if (error || data?.error) {
      const errorMessage = data?.error || error?.message || 'رمز عبور اشتباه است';
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: errorMessage,
      });
      setErrors({ password: errorMessage });
      return;
    }

    if (data?.session) {
      const access_token = data.session.access_token as string | undefined;
      const refresh_token = data.session.refresh_token as string | undefined;
      if (access_token && refresh_token) {
        await supabase.auth.setSession({
          access_token,
          refresh_token,
        });
      }
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
    setPassword('');
    setErrors({});
    setCountdown(90);
    setUserExists(null);
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      {/* Hero Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ 
          backgroundImage: 'url(/hero-background.webp)',
        }}
      >
        {/* Overlay gradient for better readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/60" />
      </div>

      {/* Content - Full screen on mobile */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-0 sm:p-4">
        <div className="w-full h-full sm:h-auto sm:max-w-md">
          <Card className="min-h-screen sm:min-h-0 rounded-none sm:rounded-lg shadow-2xl bg-card/95 backdrop-blur-md border-0 sm:border-2 flex flex-col justify-center">
            <CardHeader className="text-center space-y-2 pb-4">
              <CardTitle className="text-3xl font-bold">ورود به اهرم</CardTitle>
              <CardDescription className="text-base">
                {step === 'phone' 
                  ? 'شماره موبایل خود را وارد کنید' 
                  : step === 'not-registered'
                  ? 'حساب کاربری یافت نشد'
                  : step === 'password'
                  ? 'رمز عبور خود را وارد کنید'
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
                      ثبت‌نام در اهرم
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
                    {loading ? 'در حال بررسی...' : 'ادامه'}
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
                      ثبت‌نام در اهرم
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
            ) : step === 'password' ? (
              <form onSubmit={handleVerifyPassword}>
                <CardContent className="space-y-6 px-6">
                  <div className="space-y-4">
                    <Label className="text-base text-center block">رمز عبور</Label>
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="رمز عبور خود را وارد کنید"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        dir="ltr"
                        className={`h-12 text-lg text-center pl-12 ${errors.password ? 'border-destructive' : ''}`}
                        autoFocus
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    
                    <div className="text-center space-y-2">
                      <p className="text-sm text-muted-foreground">
                        ورود با شماره <span className="font-bold text-foreground" dir="ltr">{phoneNumber}</span>
                      </p>
                    </div>
                    
                    {errors.password && (
                      <Alert variant="destructive">
                        <AlertDescription className="text-center">{errors.password}</AlertDescription>
                      </Alert>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col space-y-3 px-6 pt-4">
                  <Button 
                    type="submit" 
                    className="w-full" 
                    size="lg"
                    disabled={loading || !password}
                  >
                    {loading ? 'در حال بررسی...' : 'ورود'}
                  </Button>
                  
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={handleBackToPhone}
                    disabled={loading}
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
                        onChange={(value) => {
                          setOtpCode(value);
                          // تایید خودکار وقتی کد کامل شد
                          if (value.length === 5 && !loading) {
                            setTimeout(() => {
                              const form = document.querySelector('form');
                              form?.requestSubmit();
                            }, 100);
                          }
                        }}
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
                    ارسال مجدد کد تایید
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
    </div>
  );
}
