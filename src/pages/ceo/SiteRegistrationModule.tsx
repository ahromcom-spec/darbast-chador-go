import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { UserPlus, Loader2, CheckCircle, Phone, User, AlertCircle, UserCheck } from 'lucide-react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useDebounce } from '@/hooks/useDebounce';
import { ModuleLayout } from '@/components/layouts/ModuleLayout';

const DEFAULT_TITLE = 'ثبت‌نام در سایت اهرم';
const DEFAULT_DESCRIPTION = 'ثبت‌نام کاربر جدید بدون نیاز به ارسال کد تایید';

export default function SiteRegistrationModule() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  const activeModuleKey = useMemo(() => {
    const fromUrl = searchParams.get('moduleKey')?.trim();
    return fromUrl || 'site_registration';
  }, [searchParams]);

  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [registeredInfo, setRegisteredInfo] = useState<{ phone: string; name: string } | null>(null);
  const [existingUser, setExistingUser] = useState<{ name: string } | null>(null);
  const [checkingPhone, setCheckingPhone] = useState(false);

  // بررسی دسترسی به ماژول
  useEffect(() => {
    const checkAccess = async () => {
      if (!user) {
        setHasAccess(false);
        return;
      }

      try {
        // بررسی نقش CEO یا GM
        const { data: roles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .in('role', ['ceo', 'general_manager', 'admin']);

        if (roles && roles.length > 0) {
          setHasAccess(true);
          return;
        }

        // بررسی اختصاص ماژول
        const { data: profile } = await supabase
          .from('profiles')
          .select('phone_number')
          .eq('user_id', user.id)
          .single();

        if (profile?.phone_number) {
          // Check for base module or any copied module that links to site_registration
          const { data: assignments } = await supabase
            .from('module_assignments')
            .select('id, module_key, module_name')
            .eq('assigned_phone_number', profile.phone_number)
            .eq('is_active', true);

          // Check if user has access via base module or a copied version
          const hasModuleAccess = assignments?.some(a => 
            a.module_key === 'site_registration' || 
            (a.module_key.startsWith('custom-') && 
              (a.module_name.includes('ثبت‌نام') || a.module_name.includes('site_registration')))
          );

          setHasAccess(!!hasModuleAccess);
        } else {
          setHasAccess(false);
        }
      } catch (error) {
        console.error('Error checking access:', error);
        setHasAccess(false);
      }
    };

    checkAccess();
  }, [user]);

  const normalizePhone = (phone: string) => {
    const persian = '۰۱۲۳۴۵۶۷۸۹';
    const arabic = '٠١٢٣٤٥٦٧٨٩';
    let normalized = phone
      .replace(/[۰-۹]/g, (d) => String(persian.indexOf(d)))
      .replace(/[٠-٩]/g, (d) => String(arabic.indexOf(d)));
    
    let raw = normalized.replace(/[^0-9+]/g, '');
    if (raw.startsWith('0098')) raw = '0' + raw.slice(4);
    else if (raw.startsWith('098')) raw = '0' + raw.slice(3);
    else if (raw.startsWith('98')) raw = '0' + raw.slice(2);
    else if (raw.startsWith('+98')) raw = '0' + raw.slice(3);
    if (raw.length === 10 && raw.startsWith('9')) raw = '0' + raw;
    raw = raw.replace(/[^0-9]/g, '');
    return raw;
  };

  const debouncedPhone = useDebounce(phoneNumber, 500);

  // بررسی وجود کاربر با شماره موبایل
  const checkExistingUser = useCallback(async (phone: string) => {
    const normalizedPhone = normalizePhone(phone);
    
    if (!/^09[0-9]{9}$/.test(normalizedPhone)) {
      setExistingUser(null);
      return;
    }

    setCheckingPhone(true);
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, user_id')
        .eq('phone_number', normalizedPhone)
        .maybeSingle();

      if (profile?.user_id) {
        setExistingUser({ name: profile.full_name || 'کاربر' });
      } else {
        setExistingUser(null);
      }
    } catch (error) {
      console.error('Error checking existing user:', error);
      setExistingUser(null);
    } finally {
      setCheckingPhone(false);
    }
  }, []);

  useEffect(() => {
    if (debouncedPhone) {
      checkExistingUser(debouncedPhone);
    } else {
      setExistingUser(null);
    }
  }, [debouncedPhone, checkExistingUser]);

  const handleRegister = async () => {
    const normalizedPhone = normalizePhone(phoneNumber);
    
    if (!/^09[0-9]{9}$/.test(normalizedPhone)) {
      toast.error('شماره موبایل باید با 09 شروع شود و 11 رقم باشد');
      return;
    }

    if (!fullName.trim()) {
      toast.error('لطفاً نام و نام خانوادگی را وارد کنید');
      return;
    }

    setLoading(true);
    setSuccess(false);

    try {
      // فراخوانی edge function برای ثبت‌نام بدون OTP
      const { data, error } = await supabase.functions.invoke('register-without-otp', {
        body: {
          phone_number: normalizedPhone,
          full_name: fullName.trim(),
          registered_by: user?.id,
        },
      });

      if (error) throw error;

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      setSuccess(true);
      setRegisteredInfo({ phone: normalizedPhone, name: fullName.trim() });
      toast.success('کاربر با موفقیت ثبت‌نام شد');
      setPhoneNumber('');
      setFullName('');
    } catch (error: any) {
      console.error('Registration error:', error);
      toast.error(error.message || 'خطا در ثبت‌نام کاربر');
    } finally {
      setLoading(false);
    }
  };

  if (hasAccess === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!hasAccess) {
    return <Navigate to="/" replace />;
  }

  return (
    <ModuleLayout
      defaultModuleKey={activeModuleKey}
      defaultTitle={DEFAULT_TITLE}
      defaultDescription={DEFAULT_DESCRIPTION}
      icon={<UserPlus className="h-5 w-5 text-primary" />}
    >
      <div className="container mx-auto p-4 md:p-6 max-w-2xl space-y-6">
        <Card className="border-2 border-teal-500/30 shadow-lg">
          <CardContent className="space-y-6 pt-4">
            <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 dark:text-amber-200 text-sm">
                توجه: با استفاده از این ماژول، کاربر مستقیماً در سایت ثبت‌نام می‌شود و کد تایید به شماره موبایل ارسال نمی‌شود.
              </AlertDescription>
            </Alert>

            {success && registeredInfo && (
              <Alert className="bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800 dark:text-green-200">
                  کاربر <strong>{registeredInfo.name}</strong> با شماره{' '}
                  <span dir="ltr" className="font-mono">{registeredInfo.phone}</span>{' '}
                  با موفقیت ثبت‌نام شد.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  نام و نام خانوادگی
                </Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="مثال: علی رضایی"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="text-right"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phoneNumber" className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  شماره موبایل
                </Label>
                <Input
                  id="phoneNumber"
                  type="tel"
                  placeholder="مثال: 09123456789"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  dir="ltr"
                  className="text-left"
                />
                {checkingPhone && (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    در حال بررسی...
                  </div>
                )}
                {existingUser && !checkingPhone && (
                  <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 py-2">
                    <UserCheck className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-blue-800 dark:text-blue-200 text-sm">
                      این شماره قبلاً با نام <strong>{existingUser.name}</strong> در سایت ثبت‌نام شده است.
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              <Button
                onClick={handleRegister}
                disabled={loading || !phoneNumber.trim() || !fullName.trim() || !!existingUser}
                className="w-full gap-2"
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    در حال ثبت‌نام...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-5 w-5" />
                    ثبت‌نام کاربر
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </ModuleLayout>
  );
}
