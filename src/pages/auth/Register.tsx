import { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
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
import { supabase } from '@/integrations/supabase/client';

const registerSchema = z.object({
  fullName: z.string().min(2, { message: 'نام و نام خانوادگی باید حداقل 2 کاراکتر باشد' }),
  phone: z.string()
    .length(11, { message: 'شماره موبایل باید 11 رقم باشد' })
    .regex(/^09\d{9}$/, { message: 'فرمت صحیح: 09123456789' }),
});

export default function Register() {
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [step, setStep] = useState<'info' | 'otp' | 'already-registered'>('info');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ fullName?: string; phone?: string; otp?: string }>({});
  const [countdown, setCountdown] = useState(90);
  
  const { user, sendOTP, verifyOTP } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  // Pre-fill phone from login redirect
  useEffect(() => {
    if (location.state?.phone) {
      setPhoneNumber(location.state.phone);
    }
  }, [location.state]);

  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

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

  // Web OTP API: auto-read SMS and autofill/submit on supported browsers
  useEffect(() => {
    // @ts-ignore - OTPCredential not in TS lib
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
          const { error } = await verifyOTP(phoneNumber, code, fullName, true);
          setLoading(false);
          if (error) {
            const errorMessage = error.message || 'کد تایید نامعتبر است.';
            setErrors({ otp: errorMessage });
          } else {
            toast({ title: 'خوش آمدید', description: 'ثبت نام شما با موفقیت انجام شد.' });
            navigate('/', { replace: true });
          }
        })();
      }
    }).catch(() => {
      // ignore
    });
    return () => ac.abort();
  }, [step, phoneNumber, fullName]);

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    try {
      registerSchema.parse({ fullName, phone: phoneNumber });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: any = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0]] = err.message;
          }
        });
        setErrors(fieldErrors);
        return;
      }
    }

    setLoading(true);

    const { error, userExists } = await sendOTP(phoneNumber, true);
    
    setLoading(false);

    // اگر این شماره قبلاً ثبت‌نام کرده باشد، مستقیماً کاربر را به ورود هدایت کنیم
    if (userExists === true && !error) {
      setStep('already-registered');
      toast({
        title: 'این شماره قبلاً ثبت‌نام شده است',
        description: 'لطفاً از بخش ورود وارد سامانه شوید.',
      });
      return;
    }

    if (error) {
      const msg = error.message || 'خطا در ارسال کد تایید';
      // اگر بک‌اند یا خطای عمومی نشان دهد کاربر وجود دارد، کاربر را به ورود هدایت کنیم
      const isGenericEdgeError = /non-2xx|Edge Function returned/i.test(msg || '');
      if (msg.includes('قبلاً') || msg.includes('قبلا') || userExists === true || isGenericEdgeError) {
        setStep('already-registered');
        toast({
          title: 'این شماره قبلاً ثبت‌نام شده است',
          description: 'لطفاً از بخش ورود وارد سامانه شوید.',
        });
        return;
      }
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: msg,
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
    const { error } = await sendOTP(phoneNumber, true);
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

    const { error } = await verifyOTP(phoneNumber, otpCode, fullName, true);
    
    setLoading(false);

    if (error) {
      const errorMessage = error.message || 'کد تایید نامعتبر است.';
      // If backend says this number is already registered, switch to login flow
      if (errorMessage.includes('قبلاً ثبت نام') || errorMessage.includes('قبلا ثبت نام')) {
        setStep('already-registered');
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
      description: 'ثبت نام شما با موفقیت انجام شد.',
    });

    navigate('/', { replace: true });
  };

  const handleBackToInfo = () => {
    setStep('info');
    setOtpCode('');
    setErrors({});
    setCountdown(90);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary p-4">
      <Card className="w-full max-w-md shadow-elegant">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-2xl font-bold text-primary">ثبت نام در سامانه</CardTitle>
          <CardDescription>
            {step === 'info' 
              ? 'اطلاعات خود را وارد کنید' 
              : step === 'already-registered'
              ? 'حساب کاربری موجود است'
              : 'کد تایید ارسال شده را وارد کنید'}
          </CardDescription>
        </CardHeader>
        {step === 'already-registered' ? (
          <>
            <CardContent className="space-y-4">
              <Alert>
                <AlertDescription className="text-center">
                  شماره موبایل <span className="font-bold">{phoneNumber}</span> قبلاً در سامانه ثبت شده است.
                  <br />
                  لطفاً از صفحه ورود وارد شوید.
                </AlertDescription>
              </Alert>
            </CardContent>
            <CardFooter className="flex flex-col space-y-3">
              <Button 
                asChild
                className="w-full construction-gradient hover:opacity-90"
              >
                <Link to="/auth/login" state={{ phone: phoneNumber }}>
                  رفتن به صفحه ورود
                </Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleBackToInfo}
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
        ) : step === 'info' ? (
          <form onSubmit={handleSendOTP}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">نام و نام خانوادگی</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="علی احمدی"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={errors.fullName ? 'border-destructive' : ''}
                />
                {errors.fullName && (
                  <p className="text-sm text-destructive">{errors.fullName}</p>
                )}
              </div>

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
                قبلاً ثبت نام کرده‌اید؟{' '}
                <Link 
                  to="/auth/login" 
                  className="text-primary hover:text-primary-light font-medium transition-colors"
                >
                  وارد شوید
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
                <p className="text-sm text-center text-muted-foreground">
                  کد تایید باید 5 رقم باشد
                </p>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-3">
              <Button 
                type="submit" 
                className="w-full construction-gradient hover:opacity-90" 
                disabled={loading || countdown === 0}
              >
                {loading ? 'در حال بررسی...' : 'تایید و ثبت نام'}
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
                onClick={handleBackToInfo}
              >
                بازگشت به اطلاعات
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
  );
}