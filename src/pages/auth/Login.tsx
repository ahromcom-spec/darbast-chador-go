import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { z } from 'zod';

const phoneSchema = z.object({
  phone: z.string()
    .min(11, { message: 'شماره تلفن باید 11 رقم باشد' })
    .max(11, { message: 'شماره تلفن باید 11 رقم باشد' })
    .regex(/^09\d{9}$/, { message: 'شماره تلفن باید با 09 شروع شود' }),
});

export default function Login() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ phone?: string; otp?: string }>({});
  
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

    const { error } = await verifyOTP(phoneNumber, otpCode);
    
    setLoading(false);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'کد تایید نامعتبر است.',
      });
      setErrors({ otp: 'کد تایید نامعتبر است' });
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
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary p-4">
      <Card className="w-full max-w-md shadow-elegant">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-2xl font-bold text-primary">ورود به سامانه</CardTitle>
          <CardDescription>
            {step === 'phone' 
              ? 'شماره موبایل خود را وارد کنید' 
              : 'کد تایید ارسال شده را وارد کنید'}
          </CardDescription>
        </CardHeader>
        {step === 'phone' ? (
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
                  dir="ltr"
                  className={`text-center ${errors.phone ? 'border-destructive' : ''}`}
                />
                {errors.phone && (
                  <p className="text-sm text-destructive">{errors.phone}</p>
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
                {loading ? 'در حال بررسی...' : 'تایید و ورود'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleBackToPhone}
              >
                تغییر شماره موبایل
              </Button>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}