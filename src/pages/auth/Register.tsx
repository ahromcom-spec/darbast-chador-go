import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { z } from 'zod';

const registerSchema = z.object({
  fullName: z.string().min(2, { message: 'نام و نام خانوادگی باید حداقل 2 کاراکتر باشد' }),
  phone: z.string()
    .length(11, { message: 'شماره موبایل باید 11 رقم باشد' })
    .regex(/^09\d{9}$/, { message: 'فرمت صحیح: 09123456789' }),
  email: z.string().email({ message: 'ایمیل نامعتبر است' }).optional().or(z.literal('')),
});

export default function Register() {
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [step, setStep] = useState<'info' | 'otp'>('info');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ fullName?: string; phone?: string; email?: string; otp?: string }>({});
  
  const { user, sendOTP, verifyOTP } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    try {
      registerSchema.parse({ fullName, phone: phoneNumber, email });
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

    const { error } = await sendOTP(phoneNumber);
    
    setLoading(false);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'خطا در ارسال کد تایید. لطفا دوباره تلاش کنید.',
      });
      return;
    }

    toast({
      title: 'موفق',
      description: 'کد تایید به شماره شما ارسال شد.',
    });
    setStep('otp');
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
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary p-4">
      <Card className="w-full max-w-md shadow-elegant">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-2xl font-bold text-primary">ثبت نام در سامانه</CardTitle>
          <CardDescription>
            {step === 'info' 
              ? 'اطلاعات خود را وارد کنید' 
              : 'کد تایید ارسال شده را وارد کنید'}
          </CardDescription>
        </CardHeader>
        {step === 'info' ? (
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

              <div className="space-y-2">
                <Label htmlFor="email">ایمیل (اختیاری)</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="example@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  dir="ltr"
                  className={errors.email ? 'border-destructive' : ''}
                />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email}</p>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <Button 
                type="submit" 
                className="w-full construction-gradient hover:opacity-90" 
                disabled={loading}
              >
                {loading ? 'در حال ارسال...' : 'ارسال کد تایید'}
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
                {errors.otp && (
                  <p className="text-sm text-destructive text-center">{errors.otp}</p>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <Button 
                type="submit" 
                className="w-full construction-gradient hover:opacity-90" 
                disabled={loading}
              >
                {loading ? 'در حال بررسی...' : 'تایید و ثبت نام'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleBackToInfo}
              >
                بازگشت به اطلاعات
              </Button>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}