import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Boxes, Loader2, ArrowLeft, Home, Check } from 'lucide-react';
import { getModuleIconByKey } from '@/components/module-shortcut/ModuleIcon';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useModuleShortcuts } from '@/hooks/useModuleShortcuts';
import { AddShortcutDialog } from '@/components/module-shortcut/AddShortcutDialog';

interface ModuleAssignment {
  id: string;
  module_key: string;
  module_name: string;
  module_href: string | null;
  module_description: string | null;
  assigned_phone_number: string;
  assigned_at: string;
  is_active: boolean;
}

interface ModuleInfo {
  key: string;
  name: string;
  description: string;
  href: string;
  color: string;
  bgColor: string;
  icon: string;
}

const MODULE_DETAILS: Record<string, ModuleInfo> = {
  scaffold_execution_with_materials: {
    key: 'scaffold_execution_with_materials',
    name: 'ماژول مدیریت اجرایی خدمات اجرای داربست به همراه اجناس',
    description: 'مدیریت و پیگیری سفارشات خدمات اجرای داربست به همراه اجناس',
    href: '/executive',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    icon: 'scaffold',
  },
  daily_report: {
    key: 'daily_report',
    name: 'ماژول گزارش روزانه شرکت اهرم',
    description: 'ثبت گزارش فعالیت‌های روزانه شرکت و نیروها',
    href: '/daily-report',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    icon: 'report',
  },
  hr_management: {
    key: 'hr_management',
    name: 'ماژول مدیریت منابع انسانی',
    description: 'ثبت و مدیریت نیروهای شرکت اهرم',
    href: '/hr-management',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    icon: 'users',
  },
  personnel_accounting: {
    key: 'personnel_accounting',
    name: 'ماژول حسابکتاب و کارکرد پرسنل',
    description: 'مشاهده کارکرد و حسابکتاب شخصی',
    href: '/personnel-accounting',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    icon: 'calculator',
  },
  my_invoice: {
    key: 'my_invoice',
    name: 'صورتحساب من',
    description: 'مشاهده صورتحساب جامع سفارشات و پرداخت‌های شخصی',
    href: '/my-invoice',
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    icon: 'receipt',
  },
  bank_cards: {
    key: 'bank_cards',
    name: 'ماژول ثبت کارت حساب بانکی',
    description: 'مدیریت کارت‌های بانکی و پیگیری موجودی',
    href: '/bank-cards',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    icon: 'credit-card',
  },
  site_registration: {
    key: 'site_registration',
    name: 'ماژول ثبت‌نام در سایت اهرم',
    description: 'ثبت‌نام کاربران جدید بدون نیاز به کد تایید',
    href: '/site-registration',
    color: 'text-teal-600',
    bgColor: 'bg-teal-50',
    icon: 'user-plus',
  },
  comprehensive_accounting: {
    key: 'comprehensive_accounting',
    name: 'ماژول حسابداری جامع',
    description: 'مدیریت حساب‌های مشتریان، نیروها و پرسنل',
    href: '/comprehensive-accounting',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    icon: 'calculator',
  },
  customer_comprehensive_invoice: {
    key: 'customer_comprehensive_invoice',
    name: 'ماژول صورتحساب جامع مشتریان',
    description: 'صدور صورتحساب جامع همه خدمات و پرداخت‌ها برای هر مشتری',
    href: '/customer-comprehensive-invoice',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    icon: 'receipt',
  },
  site_analytics: {
    key: 'site_analytics',
    name: 'ماژول آمار بازدید سایت اهرم',
    description: 'تحلیل جامع بازدیدکنندگان و رفتار کاربران',
    href: '/site-analytics',
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-50',
    icon: 'chart',
  },
  media_approval: {
    key: 'media_approval',
    name: 'ماژول مدیریت رسانه‌های سایت',
    description: 'تایید و مدیریت عکس‌ها و فیلم‌های سایت',
    href: '/media-approval',
    color: 'text-pink-600',
    bgColor: 'bg-pink-50',
    icon: 'image',
  },
  scaffolding_pricing: {
    key: 'scaffolding_pricing',
    name: 'ماژول قیمت‌گذاری داربست',
    description: 'مدیریت آیتم‌های قیمت فرم اجرای داربست به همراه اجناس و حمل و نقل',
    href: '/scaffolding-pricing',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    icon: 'dollar',
  },
  scaffolding_no_materials_pricing: {
    key: 'scaffolding_no_materials_pricing',
    name: 'ماژول قیمت‌گذاری خدمات اجرای داربست بدون اجناس',
    description: 'مدیریت آیتم‌های قیمت فرم سفارش «اجرای داربست بدون اجناس»',
    href: '/scaffolding-no-materials-pricing',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    icon: 'dollar',
  },
  service_pricing_hub: {
    key: 'service_pricing_hub',
    name: 'ماژول‌های قیمت‌گذاری خدمات',
    description: 'برای هر زیرشاخه خدمت، کلید فعال/غیرفعال و قیمت‌گذاری اختصاصی',
    href: '/service-pricing',
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    icon: 'dollar',
  },
  user_cooperation_rank: {
    key: 'user_cooperation_rank',
    name: 'ماژول رتبه همکاری کاربران',
    description: 'تعیین رتبه ۱ تا ۱۰ کاربران و اعمال تخفیف ۱٪ تا ۶٪ روی سفارش‌ها',
    href: '/user-cooperation-rank',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    icon: 'dollar',
  },
  activity_logs: {
    key: 'activity_logs',
    name: 'ماژول لاگ فعالیت‌ها و ایمیل‌های خودکار',
    description: 'ثبت هر اقدام در سایت و تنظیم ارسال خودکار ایمیل',
    href: '/activity-logs',
    color: 'text-rose-600',
    bgColor: 'bg-rose-50',
    icon: 'dollar',
  },
  contractors_management: {
    key: 'contractors_management',
    name: 'ماژول مدیریت پیمانکاران',
    description: 'بررسی درخواست‌های پیمانکاران، فعال/غیرفعال‌سازی، و ارجاع سفارش‌ها به پیمانکاران',
    href: '/ceo/contractors-management',
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    icon: 'image',
  },
  dynamic_services_management: {
    key: 'dynamic_services_management',
    name: 'ماژول مدیریت خدمات داینامیک',
    description: 'مدیریت درختی خدمات و زیرشاخه‌های نمایش‌داده‌شده در صفحه اصلی',
    href: '/ceo/dynamic-services',
    color: 'text-sky-600',
    bgColor: 'bg-sky-50',
    icon: 'settings',
  },
  service_geo_availability: {
    key: 'service_geo_availability',
    name: 'ماژول مدیریت خدمات طبق شهرها',
    description: 'فعال/غیرفعال کردن هر خدمت در استان‌ها و شهرهای مشخص',
    href: '/ceo/service-geo-availability',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    icon: 'settings',
  },
  user_impersonation: {
    key: 'user_impersonation',
    name: 'ماژول ورود به حساب کاربران',
    description: 'ورود به حساب کاربران سایت برای انجام عملیات به نمایندگی از آن‌ها',
    href: '/admin/users',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    icon: 'users',
  },
  help_videos: {
    key: 'help_videos',
    name: 'ماژول فیلم‌های آموزشی سایت',
    description: 'آپلود و اتصال فیلم‌های راهنما به هر بخش سایت (صفحه نخست، پروفایل، فرم‌ها و...)',
    href: '/help-videos',
    color: 'text-violet-600',
    bgColor: 'bg-violet-50',
    icon: 'video',
  },
};

function buildModuleUrl(href: string, moduleKey: string) {
  try {
    const url = new URL(href, window.location.origin);
    url.searchParams.set('moduleKey', moduleKey);
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    const sep = href.includes('?') ? '&' : '?';
    return `${href}${sep}moduleKey=${encodeURIComponent(moduleKey)}`;
  }
}

export function UserModulesTab() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<ModuleAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [userPhone, setUserPhone] = useState<string | null>(null);
  const { addShortcut, hasShortcut } = useModuleShortcuts();
  const [shortcutDialog, setShortcutDialog] = useState<{
    open: boolean;
    moduleKey: string;
    moduleName: string;
    moduleDescription: string;
    moduleHref: string;
  }>({ open: false, moduleKey: '', moduleName: '', moduleDescription: '', moduleHref: '' });
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);

  const handleLongPressStart = useCallback(
    (moduleKey: string, moduleName: string, moduleDescription: string, moduleHref: string) => {
      longPressFiredRef.current = false;
      longPressTimerRef.current = setTimeout(() => {
        longPressFiredRef.current = true;
        console.log('Long press fired for module:', moduleKey);
        if (hasShortcut(moduleKey)) {
          toast.info('این ماژول قبلاً به صفحه نخست اضافه شده است');
        } else {
          setShortcutDialog({ open: true, moduleKey, moduleName, moduleDescription, moduleHref });
        }
      }, 3000);
    },
    [hasShortcut]
  );

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleCardClick = useCallback((e: React.MouseEvent, moduleUrl: string) => {
    if (longPressFiredRef.current) {
      e.preventDefault();
      e.stopPropagation();
      longPressFiredRef.current = false;
      return;
    }
    navigate(moduleUrl);
  }, [navigate]);

  const handleConfirmShortcut = useCallback(async () => {
    const { moduleKey, moduleName, moduleDescription, moduleHref } = shortcutDialog;
    const ok = await addShortcut(moduleKey, moduleName, moduleDescription, moduleHref);
    if (ok) {
      toast.success('میانبر ماژول به صفحه نخست اضافه شد');
    } else {
      toast.error('خطا در افزودن میانبر');
    }
    setShortcutDialog((prev) => ({ ...prev, open: false }));
  }, [shortcutDialog, addShortcut]);

  const handleAddShortcutClick = useCallback(
    (e: React.MouseEvent, moduleKey: string, moduleName: string, moduleDescription: string, moduleHref: string) => {
      e.preventDefault();
      e.stopPropagation();
      if (hasShortcut(moduleKey)) {
        toast.info('این ماژول قبلاً به صفحه نخست اضافه شده است');
        return;
      }
      setShortcutDialog({ open: true, moduleKey, moduleName, moduleDescription, moduleHref });
    },
    [hasShortcut]
  );

  useEffect(() => {
    fetchUserPhone();
  }, [user]);

  useEffect(() => {
    if (userPhone) {
      fetchUserModules();
    }
  }, [userPhone]);

  // Subscribe to realtime changes on module_assignments so new assignments show immediately
  useEffect(() => {
    if (!userPhone) return;

    const channel = supabase
      .channel('user-module-assignments')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'module_assignments',
        },
        (payload: any) => {
          // Re-fetch when any change involves this user's phone
          const row = payload.new || payload.old;
          if (row?.assigned_phone_number === userPhone) {
            fetchUserModules();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userPhone]);

  const fetchUserPhone = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('phone_number')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      setUserPhone(data?.phone_number || null);
    } catch (error) {
      console.error('Error fetching user phone:', error);
      setLoading(false);
    }
  };

  const fetchUserModules = async () => {
    if (!userPhone) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('module_assignments')
        .select('*')
        .eq('assigned_phone_number', userPhone)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAssignments(data || []);
    } catch (error) {
      console.error('Error fetching module assignments:', error);
      toast.error('خطا در دریافت ماژول‌ها');
    } finally {
      setLoading(false);
    }
  };

  const resolveBaseModuleKey = (assignment: ModuleAssignment): string => {
    if (MODULE_DETAILS[assignment.module_key]) return assignment.module_key;

    const name = assignment.module_name || '';
    // Heuristics for copied modules (custom-* keys)
    if (name.includes('گزارش روزانه')) return 'daily_report';
    if (name.includes('منابع انسانی')) return 'hr_management';
    if (name.includes('حسابکتاب') || name.includes('کارکرد')) return 'personnel_accounting';
    if (name.includes('صورتحساب')) return 'my_invoice';
    if (name.includes('کارت') || name.includes('بانک')) return 'bank_cards';
    if (name.includes('ثبت‌نام') || name.includes('ثبت نام')) return 'site_registration';
    if (name.includes('حسابداری جامع')) return 'comprehensive_accounting';
    if (name.includes('صورتحساب جامع مشتری')) return 'customer_comprehensive_invoice';
    if (name.includes('آمار') || name.includes('بازدید')) return 'site_analytics';
    if (name.includes('رسانه')) return 'media_approval';
    if (name.includes('فیلم') && (name.includes('آموزش') || name.includes('راهنما'))) return 'help_videos';
    if (name.includes('سفارشات') || name.includes('داربست') || name.includes('اجرایی')) return 'scaffold_execution_with_materials';

    return assignment.module_key;
  };

  const getModuleInfo = (assignment: ModuleAssignment): ModuleInfo => {
    const baseKey = resolveBaseModuleKey(assignment);
    const base = MODULE_DETAILS[baseKey];
    if (base) {
      return {
        ...base,
        key: assignment.module_key,
        name: assignment.module_name || base.name,
        // Use stored href/description from DB if available (for custom modules)
        href: assignment.module_href || base.href,
        description: assignment.module_description || base.description,
      };
    }

    return {
      key: assignment.module_key,
      name: assignment.module_name || assignment.module_key,
      description: assignment.module_description || '',
      href: assignment.module_href || '/',
      color: 'text-gray-600',
      bgColor: 'bg-gray-50',
      icon: 'default',
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="mr-3 text-muted-foreground">در حال بارگذاری ماژول‌ها...</span>
      </div>
    );
  }

  if (assignments.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Boxes className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-semibold mb-2">ماژولی یافت نشد</h3>
          <p className="text-muted-foreground">
            هنوز ماژولی به شما اختصاص داده نشده است. برای دریافت دسترسی با مدیر سیستم تماس بگیرید.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
          <Boxes className="h-5 w-5 text-primary" />
          ماژول‌های من
        </h3>
        <p className="text-sm text-muted-foreground">
          ماژول‌هایی که به شما اختصاص داده شده و می‌توانید به آنها دسترسی داشته باشید
        </p>
      </div>

      <div className="grid gap-4">
      {assignments.map((assignment) => {
          const moduleInfo = getModuleInfo(assignment);
          const moduleUrl = buildModuleUrl(moduleInfo.href, assignment.module_key);
          // Use module_name from database (synced by CEO) as primary source
          const displayName = assignment.module_name || MODULE_DETAILS[assignment.module_key]?.name || assignment.module_key;
          return (
            <Card
                  key={assignment.id}
                  className="border-2 border-primary/20 hover:border-primary/40 transition-all cursor-pointer group select-none"
                  onClick={(e) => handleCardClick(e, moduleUrl)}
                  onContextMenu={(e) => e.preventDefault()}
                  onMouseDown={() =>
                    handleLongPressStart(assignment.module_key, displayName, moduleInfo.description, moduleInfo.href)
                  }
                  onMouseUp={handleLongPressEnd}
                  onMouseLeave={handleLongPressEnd}
                  onTouchStart={() =>
                    handleLongPressStart(assignment.module_key, displayName, moduleInfo.description, moduleInfo.href)
                  }
                  onTouchEnd={handleLongPressEnd}
                  onTouchCancel={handleLongPressEnd}
                >
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="flex items-center gap-3 sm:gap-4">
                        {(() => { const Icon = getModuleIconByKey(assignment.module_key, displayName); return (
                        <div className={`p-2.5 sm:p-3 rounded-xl ${moduleInfo.bgColor} group-hover:scale-105 transition-transform flex-shrink-0`}>
                          <Icon className={`h-6 w-6 sm:h-8 sm:w-8 ${moduleInfo.color}`} />
                        </div>
                        ); })()}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-sm sm:text-lg text-foreground mb-0.5 sm:mb-1 whitespace-normal leading-relaxed">
                            {displayName}
                          </h4>
                          <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
                            {moduleInfo.description}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 w-full sm:w-auto flex-shrink-0">
                        <Button
                          variant={hasShortcut(assignment.module_key) ? 'secondary' : 'outline'}
                          size="sm"
                          className="gap-1.5 flex-shrink-0"
                          onClick={(e) =>
                            handleAddShortcutClick(e, assignment.module_key, displayName, moduleInfo.description, moduleInfo.href)
                          }
                          title={hasShortcut(assignment.module_key) ? 'به صفحه نخست اضافه شده' : 'افزودن به صفحه نخست'}
                        >
                          {hasShortcut(assignment.module_key) ? (
                            <>
                              <Check className="h-4 w-4" />
                              <span className="hidden sm:inline">در صفحه نخست</span>
                            </>
                          ) : (
                            <>
                              <Home className="h-4 w-4" />
                              <span className="hidden sm:inline">افزودن به صفحه نخست</span>
                            </>
                          )}
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          className="gap-2 group-hover:translate-x-[-4px] transition-transform flex-1 sm:flex-initial"
                        >
                          <span>ورود به ماژول</span>
                          <ArrowLeft className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
          );
        })}
      </div>

      <AddShortcutDialog
        open={shortcutDialog.open}
        onOpenChange={(open) => setShortcutDialog((prev) => ({ ...prev, open }))}
        moduleName={shortcutDialog.moduleName}
        onConfirm={handleConfirmShortcut}
      />

      <p className="text-xs text-muted-foreground text-center mt-4">
        💡 برای افزودن میانبر ماژول به صفحه نخست، روی دکمه «افزودن به صفحه نخست» کلیک کنید (یا ۳ ثانیه روی کارت ماژول نگه دارید)
      </p>
    </div>
  );
}
