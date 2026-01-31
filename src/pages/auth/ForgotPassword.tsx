import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Home, Phone, Mail, Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

type ResetMethod = 'sms' | 'email' | null;
type Step = 'choose' | 'phone-input' | 'email-input' | 'verify-otp' | 'verify-email' | 'new-password';

const toAsciiDigits = (input: string) => {
  const persian = '۰۱۲۳۴۵۶۷۸۹';
  const arabic = '٠١٢٣٤٥٦٧٨٩';
  return input
    .replace(/[۰-۹]/g, (d) => String(persian.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(arabic.indexOf(d)));
};

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('choose');
  const [method, setMethod] = useState<ResetMethod>(null);
  const [loading, setLoading] = useState(false);
  
  // Form states
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const handleChooseSMS = () => {
    setMethod('sms');
    setStep('phone-input');
  };

  const handleChooseEmail = () => {
    setMethod('email');
    setStep('email-input');
  };

  const handleSendSMSCode = async () => {
    if (!/^09\d{9}$/.test(phoneNumber)) {
      toast.error('شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود');
      return;
    }

    setLoading(true);
    try {
      // First check if user has password
      const { data: checkData } = await supabase.functions.invoke('manage-password', {
        body: { action: 'check_has_password', phone_number: phoneNumber }
      });

      if (!checkData?.has_password) {
        toast.error('این حساب رمز عبور ندارد');
        setLoading(false);
        return;
      }

      // Send OTP using existing send-otp function
      const { data, error } = await supabase.functions.invoke('send-otp', {
        body: { phone_number: phoneNumber, is_registration: false }
      });

      if (error || data?.error) {
        toast.error(data?.error || 'خطا در ارسال کد تایید');
        return;
      }

      toast.success('کد تایید ارسال شد');
      setStep('verify-otp');
      setCountdown(90);

      // Start countdown
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (e) {
      toast.error('خطا در ارسال کد تایید');
    } finally {
      setLoading(false);
    }
  };

  const handleSendEmailCode = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('فرمت ایمیل نامعتبر است');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-password', {
        body: { action: 'send_email_reset_code', email }
      });

      if (error || data?.error) {
        toast.error(data?.error || 'خطا در ارسال کد تایید');
        return;
      }

      toast.success('کد تایید به ایمیل ارسال شد');
      setStep('verify-email');
      
      // Debug code for testing
      if (data?.debug_code) {
        console.log('Email reset code:', data.debug_code);
      }
    } catch (e) {
      toast.error('خطا در ارسال کد تایید');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (otpCode.length !== 5) {
      toast.error('کد تایید باید ۵ رقم باشد');
      return;
    }

    // Just verify and move to password step (actual verification happens on reset)
    setStep('new-password');
  };

  const handleVerifyEmail = async () => {
    if (emailCode.length !== 6) {
      toast.error('کد تایید باید ۶ رقم باشد');
      return;
    }

    setStep('new-password');
  };

  const handleResetPassword = async () => {
    if (newPassword.length < 6) {
      toast.error('رمز عبور باید حداقل ۶ کاراکتر باشد');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('رمز عبور و تکرار آن مطابقت ندارند');
      return;
    }

    setLoading(true);
    try {
      let response;
      
      if (method === 'sms') {
        response = await supabase.functions.invoke('manage-password', {
          body: {
            action: 'reset_password_via_otp',
            phone_number: phoneNumber,
            otp_code: otpCode,
            new_password: newPassword
          }
        });
      } else {
        response = await supabase.functions.invoke('manage-password', {
          body: {
            action: 'reset_password_via_email',
            email,
            email_code: emailCode,
            new_password: newPassword
          }
        });
      }

      if (response.error || response.data?.error) {
        toast.error(response.data?.error || 'خطا در تغییر رمز عبور');
        return;
      }

      toast.success('رمز عبور با موفقیت تغییر کرد');
      navigate('/auth/login');
    } catch (e) {
      toast.error('خطا در تغییر رمز عبور');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (step === 'phone-input' || step === 'email-input') {
      setStep('choose');
      setMethod(null);
    } else if (step === 'verify-otp') {
      setStep('phone-input');
      setOtpCode('');
    } else if (step === 'verify-email') {
      setStep('email-input');
      setEmailCode('');
    } else if (step === 'new-password') {
      if (method === 'sms') {
        setStep('verify-otp');
      } else {
        setStep('verify-email');
      }
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: 'url(/hero-background.webp)' }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/60" />
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center p-0 sm:p-4">
        <div className="w-full h-full sm:h-auto sm:max-w-md">
          <Card className="min-h-screen sm:min-h-0 rounded-none sm:rounded-lg shadow-2xl bg-card/95 backdrop-blur-md border-0 sm:border-2 flex flex-col justify-center">
            <CardHeader className="text-center space-y-2 pb-4">
              <CardTitle className="text-2xl font-bold">بازیابی رمز عبور</CardTitle>
              <CardDescription>
                {step === 'choose' && 'روش بازیابی را انتخاب کنید'}
                {step === 'phone-input' && 'شماره موبایل خود را وارد کنید'}
                {step === 'email-input' && 'ایمیل بازیابی خود را وارد کنید'}
                {step === 'verify-otp' && 'کد تایید ارسال شده را وارد کنید'}
                {step === 'verify-email' && 'کد ارسال شده به ایمیل را وارد کنید'}
                {step === 'new-password' && 'رمز عبور جدید را وارد کنید'}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4 px-6">
              {/* Choose Method */}
              {step === 'choose' && (
                <div className="space-y-3">
                  <Button
                    variant="outline"
                    className="w-full h-16 justify-start gap-4"
                    onClick={handleChooseSMS}
                  >
                    <Phone className="h-6 w-6 text-primary" />
                    <div className="text-right">
                      <div className="font-medium">ارسال کد به موبایل</div>
                      <div className="text-xs text-muted-foreground">دریافت کد تایید پیامکی</div>
                    </div>
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full h-16 justify-start gap-4"
                    onClick={handleChooseEmail}
                  >
                    <Mail className="h-6 w-6 text-primary" />
                    <div className="text-right">
                      <div className="font-medium">ارسال کد به ایمیل</div>
                      <div className="text-xs text-muted-foreground">نیاز به ایمیل بازیابی ثبت‌شده</div>
                    </div>
                  </Button>
                </div>
              )}

              {/* Phone Input */}
              {step === 'phone-input' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>شماره موبایل</Label>
                    <Input
                      type="tel"
                      placeholder="09123456789"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(toAsciiDigits(e.target.value))}
                      maxLength={11}
                      dir="ltr"
                      className="h-12 text-lg text-center"
                    />
                  </div>
                  <Button
                    onClick={handleSendSMSCode}
                    disabled={loading || phoneNumber.length !== 11}
                    className="w-full"
                    size="lg"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
                    ارسال کد تایید
                  </Button>
                </div>
              )}

              {/* Email Input */}
              {step === 'email-input' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>ایمیل بازیابی</Label>
                    <Input
                      type="email"
                      placeholder="example@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      dir="ltr"
                      className="h-12 text-center"
                    />
                  </div>
                  <Button
                    onClick={handleSendEmailCode}
                    disabled={loading || !email}
                    className="w-full"
                    size="lg"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
                    ارسال کد تایید
                  </Button>
                </div>
              )}

              {/* Verify OTP */}
              {step === 'verify-otp' && (
                <div className="space-y-4">
                  <div className="flex justify-center" dir="ltr">
                    <InputOTP
                      maxLength={5}
                      value={otpCode}
                      onChange={(value) => setOtpCode(value)}
                      inputMode="numeric"
                      autoFocus
                    >
                      <InputOTPGroup className="gap-2">
                        {[0, 1, 2, 3, 4].map((i) => (
                          <InputOTPSlot key={i} index={i} className="w-12 h-14 text-xl" />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  {countdown > 0 && (
                    <p className="text-sm text-center text-muted-foreground">
                      زمان باقی‌مانده: <span className="font-bold text-primary">{countdown}</span> ثانیه
                    </p>
                  )}
                  <Button
                    onClick={handleVerifyOTP}
                    disabled={loading || otpCode.length !== 5}
                    className="w-full"
                    size="lg"
                  >
                    تایید و ادامه
                  </Button>
                </div>
              )}

              {/* Verify Email */}
              {step === 'verify-email' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>کد تایید ۶ رقمی</Label>
                    <Input
                      type="text"
                      value={emailCode}
                      onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="۱۲۳۴۵۶"
                      dir="ltr"
                      maxLength={6}
                      className="h-12 text-lg text-center"
                    />
                  </div>
                  <Button
                    onClick={handleVerifyEmail}
                    disabled={loading || emailCode.length !== 6}
                    className="w-full"
                    size="lg"
                  >
                    تایید و ادامه
                  </Button>
                </div>
              )}

              {/* New Password */}
              {step === 'new-password' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>رمز عبور جدید</Label>
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="حداقل ۶ کاراکتر"
                        dir="ltr"
                        className="h-12 pl-12"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute left-2 top-1/2 -translate-y-1/2"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>تکرار رمز عبور</Label>
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="تکرار رمز عبور"
                      dir="ltr"
                      className="h-12"
                    />
                  </div>
                  <Button
                    onClick={handleResetPassword}
                    disabled={loading || !newPassword || !confirmPassword}
                    className="w-full"
                    size="lg"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
                    تغییر رمز عبور
                  </Button>
                </div>
              )}
            </CardContent>

            <CardFooter className="flex flex-col space-y-3 px-6 pt-4">
              {step !== 'choose' && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleBack}
                >
                  <ArrowRight className="h-4 w-4 ml-2" />
                  بازگشت
                </Button>
              )}
              <Button
                variant="ghost"
                className="w-full"
                asChild
              >
                <Link to="/auth/login">
                  <Home className="h-4 w-4 ml-2" />
                  بازگشت به صفحه ورود
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
