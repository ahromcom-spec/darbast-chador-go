import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Boxes, Building2, Loader2, ArrowLeft } from 'lucide-react';
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
                        <div className={`p-2.5 sm:p-3 rounded-xl ${moduleInfo.bgColor} group-hover:scale-105 transition-transform flex-shrink-0`}>
                          <Building2 className={`h-6 w-6 sm:h-8 sm:w-8 ${moduleInfo.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-sm sm:text-lg text-foreground mb-0.5 sm:mb-1 whitespace-normal leading-relaxed">
                            {displayName}
                          </h4>
                          <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
                            {moduleInfo.description}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="default"
                        size="sm"
                        className="gap-2 group-hover:translate-x-[-4px] transition-transform w-full sm:w-auto flex-shrink-0"
                      >
                        <span>ورود به ماژول</span>
                        <ArrowLeft className="h-4 w-4" />
                      </Button>
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
        💡 برای افزودن میانبر ماژول به صفحه نخست، ۳ ثانیه روی ماژول فشار دهید و نگه دارید
      </p>
    </div>
  );
}
