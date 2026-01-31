import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff, Lock, Mail, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface PasswordManagementProps {
  userId: string;
  phoneNumber: string;
  currentEmail?: string | null;
  emailVerified?: boolean;
  hasPassword?: boolean;
  onUpdate?: () => void;
}

export function PasswordManagement({
  userId,
  phoneNumber,
  currentEmail,
  emailVerified,
  hasPassword,
  onUpdate
}: PasswordManagementProps) {
  const [activeSection, setActiveSection] = useState<'password' | 'email' | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Password states
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Email states
  const [email, setEmail] = useState(currentEmail || '');
  const [emailCode, setEmailCode] = useState('');
  const [emailCodeSent, setEmailCodeSent] = useState(false);

  const handleSetPassword = async () => {
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
      const { data, error } = await supabase.functions.invoke('manage-password', {
        body: {
          action: 'set_password',
          user_id: userId,
          password: newPassword
        }
      });

      if (error || data?.error) {
        toast.error(data?.error || 'خطا در تنظیم رمز عبور');
        return;
      }

      toast.success('رمز عبور با موفقیت تنظیم شد');
      setNewPassword('');
      setConfirmPassword('');
      setActiveSection(null);
      onUpdate?.();
    } catch (e) {
      toast.error('خطا در تنظیم رمز عبور');
    } finally {
      setLoading(false);
    }
  };

  const handleSendEmailCode = async () => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('فرمت ایمیل نامعتبر است');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-password', {
        body: {
          action: 'set_recovery_email',
          user_id: userId,
          email
        }
      });

      if (error || data?.error) {
        toast.error(data?.error || 'خطا در ارسال کد تایید');
        return;
      }

      toast.success('کد تایید به ایمیل شما ارسال شد');
      setEmailCodeSent(true);
      
      // For testing, show the code in console
      if (data?.debug_code) {
        console.log('Email verification code:', data.debug_code);
      }
    } catch (e) {
      toast.error('خطا در ارسال کد تایید');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmail = async () => {
    if (emailCode.length !== 6) {
      toast.error('کد تایید باید ۶ رقم باشد');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-password', {
        body: {
          action: 'verify_email',
          user_id: userId,
          email_code: emailCode
        }
      });

      if (error || data?.error) {
        toast.error(data?.error || 'کد تایید نامعتبر است');
        return;
      }

      toast.success('ایمیل با موفقیت تایید شد');
      setEmailCode('');
      setEmailCodeSent(false);
      setActiveSection(null);
      onUpdate?.();
    } catch (e) {
      toast.error('خطا در تایید ایمیل');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Lock className="h-5 w-5 text-primary" />
          مدیریت رمز عبور و بازیابی
        </CardTitle>
        <CardDescription>
          تنظیم رمز عبور ثابت و ایمیل بازیابی برای دسترسی آسان‌تر
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Password Section */}
        <div className="p-4 border rounded-lg space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">رمز عبور ثابت</span>
              {hasPassword && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                  فعال
                </span>
              )}
            </div>
            <Button
              variant={activeSection === 'password' ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setActiveSection(activeSection === 'password' ? null : 'password')}
            >
              {hasPassword ? 'تغییر' : 'تنظیم'}
            </Button>
          </div>

          {activeSection === 'password' && (
            <div className="space-y-3 pt-2 border-t">
              <div className="space-y-2">
                <Label>رمز عبور جدید</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="حداقل ۶ کاراکتر"
                    dir="ltr"
                    className="pl-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute left-1 top-1/2 -translate-y-1/2 h-8 w-8"
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
                />
              </div>
              <Button
                onClick={handleSetPassword}
                disabled={loading || !newPassword || !confirmPassword}
                className="w-full"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin ml-2" />
                ) : (
                  <Check className="h-4 w-4 ml-2" />
                )}
                ذخیره رمز عبور
              </Button>
            </div>
          )}
        </div>

        {/* Email Section */}
        <div className="p-4 border rounded-lg space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">ایمیل بازیابی</span>
              {emailVerified && currentEmail && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                  تایید شده
                </span>
              )}
            </div>
            <Button
              variant={activeSection === 'email' ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setActiveSection(activeSection === 'email' ? null : 'email')}
            >
              {currentEmail ? 'تغییر' : 'افزودن'}
            </Button>
          </div>

          {currentEmail && !activeSection && (
            <p className="text-sm text-muted-foreground" dir="ltr">
              {currentEmail}
            </p>
          )}

          {activeSection === 'email' && (
            <div className="space-y-3 pt-2 border-t">
              {!emailCodeSent ? (
                <>
                  <div className="space-y-2">
                    <Label>آدرس ایمیل</Label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="example@email.com"
                      dir="ltr"
                    />
                  </div>
                  <Button
                    onClick={handleSendEmailCode}
                    disabled={loading || !email}
                    className="w-full"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin ml-2" />
                    ) : (
                      <Mail className="h-4 w-4 ml-2" />
                    )}
                    ارسال کد تایید
                  </Button>
                </>
              ) : (
                <>
                  <Alert>
                    <AlertDescription>
                      کد تایید به {email} ارسال شد. لطفاً کد را وارد کنید.
                    </AlertDescription>
                  </Alert>
                  <div className="space-y-2">
                    <Label>کد تایید ۶ رقمی</Label>
                    <Input
                      type="text"
                      value={emailCode}
                      onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="۱۲۳۴۵۶"
                      dir="ltr"
                      maxLength={6}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleVerifyEmail}
                      disabled={loading || emailCode.length !== 6}
                      className="flex-1"
                    >
                      {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin ml-2" />
                      ) : (
                        <Check className="h-4 w-4 ml-2" />
                      )}
                      تایید
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEmailCodeSent(false);
                        setEmailCode('');
                      }}
                    >
                      تغییر ایمیل
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <Alert>
          <AlertDescription className="text-sm">
            با تنظیم رمز عبور می‌توانید بدون نیاز به کد پیامکی وارد شوید. 
            در صورت فراموشی رمز، از کد پیامکی یا ایمیل بازیابی استفاده کنید.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
