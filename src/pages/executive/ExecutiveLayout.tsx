import { Outlet, NavLink, useLocation, Navigate, useSearchParams, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, Users, ClipboardCheck, Play, Loader, CheckCircle, Banknote, PackageOpen, ArrowLeftRight, ChevronDown, ListOrdered, Archive, PackageCheck, Package, ArrowRight, Receipt, Lock, FileText, Files } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useModuleAssignmentInfo } from '@/hooks/useModuleAssignmentInfo';

// نقش‌های مجاز برای دسترسی به پنل مدیریت اجرایی
const ALLOWED_ROLES = [
  'admin',
  'ceo',
  'general_manager',
  'sales_manager',
  'scaffold_executive_manager',
  'executive_manager_scaffold_execution_with_materials',
  'rental_executive_manager',
  'finance_manager'
];

// مراحل سفارشات مشتری
const orderStagesItems = [
  {
    title: 'در انتظار تایید مدیران',
    href: '/executive/pending-orders',
    icon: ClipboardCheck
  },
  {
    title: 'در انتظار اجرا',
    href: '/executive/ready',
    icon: Play
  },
  {
    title: 'در حال اجرا',
    href: '/executive/in-progress',
    icon: Loader
  },
  {
    title: 'اجرا شد',
    href: '/executive/stage-order-executed',
    icon: CheckCircle
  },
  {
    title: 'در انتظار پرداخت',
    href: '/executive/stage-awaiting-payment',
    icon: Banknote
  },
  {
    title: 'در انتظار جمع‌آوری',
    href: '/executive/stage-awaiting-collection',
    icon: PackageOpen
  },
  {
    title: 'در حال جمع‌آوری',
    href: '/executive/stage-in-collection',
    icon: Package
  },
  {
    title: 'جمع‌آوری شد',
    href: '/executive/stage-collected',
    icon: PackageCheck
  },
  {
    title: 'تکمیل سفارش',
    href: '/executive/completed',
    icon: CheckCircle
  },
  {
    title: 'همه سفارشات',
    href: '/executive/all-orders',
    icon: ShoppingCart
  },
];

// آیتم‌های زیرمجموعه صورتحساب‌های مشتریان
const statementsItems = [
  { title: 'صورتحساب‌های باز', href: '/executive/statements?filter=open', icon: FileText, key: 'open' },
  { title: 'صورتحساب‌های بسته شده', href: '/executive/statements?filter=closed', icon: Lock, key: 'closed' },
  { title: 'همه صورتحساب‌ها', href: '/executive/statements?filter=all', icon: Files, key: 'all' },
];

// آیتم‌های اصلی ناوبری
const mainNavItems = [
  {
    title: 'داشبورد',
    href: '/executive',
    icon: LayoutDashboard
  },
  {
    title: 'مشتریان',
    href: '/executive/customers',
    icon: Users
  },
  {
    title: 'انتقال و همکاری سفارش',
    href: '/executive/order-transfers',
    icon: ArrowLeftRight
  },
  {
    title: 'بایگانی',
    href: '/executive/archived',
    icon: Archive
  }
];

export function ExecutiveLayout() {
  const { user, loading: authLoading } = useAuth();
  const [hasAccess, setHasAccess] = useState(false);
  const [roleLoading, setRoleLoading] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activeModuleKey = searchParams.get('moduleKey') || 'scaffold_execution_with_materials';
  const { moduleName } = useModuleAssignmentInfo(activeModuleKey, 'ماژول مدیریت اجرای داربست', '');

  // Redirect to "همه سفارشات" on initial entry so managers land on the orders list directly.
  // They can still navigate back to the dashboard tab manually.
  const didInitialRedirect = useRef(false);
  useEffect(() => {
    if (didInitialRedirect.current) return;
    const isOnIndex = location.pathname === '/executive' || location.pathname === '/executive/';
    if (isOnIndex) {
      didInitialRedirect.current = true;
      const qs = activeModuleKey ? `?moduleKey=${activeModuleKey}` : '';
      navigate(`/executive/all-orders${qs}`, { replace: true });
    } else {
      didInitialRedirect.current = true;
    }
  }, [location.pathname, activeModuleKey, navigate]);

  useEffect(() => {
    const checkExecutiveRole = async () => {
      if (!user) {
        setHasAccess(false);
        setRoleLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);

        if (error) {
          console.error('Error checking executive role:', error);
          setHasAccess(false);
        } else {
          const userRoles = data?.map(r => r.role) || [];
          const hasAllowedRole = userRoles.some(role => ALLOWED_ROLES.includes(role));
          setHasAccess(hasAllowedRole);
        }
      } catch (error) {
        console.error('Error checking executive role:', error);
        setHasAccess(false);
      } finally {
        setRoleLoading(false);
      }
    };

    checkExecutiveRole();
  }, [user]);
  
  // بررسی اینکه آیا صفحه فعلی یکی از مراحل سفارش است
  const isOrderStageActive = orderStagesItems.some(item => 
    location.pathname === item.href || location.pathname.startsWith(item.href + '/')
  );
  
  // پیدا کردن عنوان مرحله فعلی
  const activeStage = orderStagesItems.find(item => 
    location.pathname === item.href || location.pathname.startsWith(item.href + '/')
  );

  // وضعیت دراپ‌داون صورتحساب‌ها
  const isStatementsActive = location.pathname.startsWith('/executive/statements');
  const currentFilter = searchParams.get('filter') || 'all';
  const activeStatement = statementsItems.find(i => i.key === currentFilter);

  // نمایش لودینگ در حین بررسی نقش
  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-muted-foreground">در حال بارگذاری...</p>
        </div>
      </div>
    );
  }

  // اگر کاربر لاگین نکرده یا دسترسی ندارد، به صفحه اصلی هدایت شود
  if (!user || !hasAccess) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Module Name Header */}
      <div className="bg-primary/5 border-b border-primary/10">
        <div className="w-full max-w-none px-4 py-2 flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/profile?tab=modules')}
            className="gap-2"
          >
            بازگشت
            <ArrowRight className="h-4 w-4" />
          </Button>
          <p className="text-sm font-medium text-primary">
            {moduleName}
          </p>
        </div>
      </div>
      
      <div className="border-b bg-card">
        <div className="w-full max-w-none px-4">
          <nav className="flex gap-1 overflow-x-auto py-1">
            {/* آیتم‌های اصلی ناوبری */}
            {mainNavItems.map((item) => (
              <NavLink
                key={item.href}
                to={`${item.href}?moduleKey=${activeModuleKey}`}
                end={item.href === '/executive'}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 whitespace-nowrap',
                    'hover:bg-accent/10',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )
                }
              >
                <item.icon className="h-4 w-4" />
                {item.title}
              </NavLink>
            ))}

            {/* دراپ‌داون مراحل سفارشات مشتری */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className={cn(
                    'flex items-center gap-2 px-4 py-3 h-auto text-sm font-medium rounded-lg transition-all duration-200 whitespace-nowrap',
                    'hover:bg-accent/10',
                    isOrderStageActive
                      ? 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <ListOrdered className="h-4 w-4" />
                  {activeStage ? activeStage.title : 'مراحل سفارشات مشتری'}
                  <ChevronDown className="h-3 w-3 mr-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg z-50">
                {orderStagesItems.map((item) => (
                  <DropdownMenuItem key={item.href} asChild>
                    <NavLink
                      to={`${item.href}?moduleKey=${activeModuleKey}`}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-2 w-full cursor-pointer text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700',
                          isActive && 'bg-primary/10 text-primary font-medium'
                        )
                      }
                    >
                      <item.icon className="h-4 w-4" />
                      {item.title}
                    </NavLink>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* دراپ‌داون صورتحساب‌های مشتریان */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className={cn(
                    'flex items-center gap-2 px-4 py-3 h-auto text-sm font-medium rounded-lg transition-all duration-200 whitespace-nowrap',
                    'hover:bg-accent/10',
                    isStatementsActive
                      ? 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Receipt className="h-4 w-4" />
                  {isStatementsActive && activeStatement ? activeStatement.title : 'صورتحساب‌های مشتریان'}
                  <ChevronDown className="h-3 w-3 mr-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg z-50">
                {statementsItems.map((item) => (
                  <DropdownMenuItem key={item.key} asChild>
                    <NavLink
                      to={`${item.href}&moduleKey=${activeModuleKey}`}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-2 w-full cursor-pointer text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700',
                          isActive && currentFilter === item.key && 'bg-primary/10 text-primary font-medium'
                        )
                      }
                    >
                      <item.icon className="h-4 w-4" />
                      {item.title}
                    </NavLink>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>
        </div>
      </div>

      <div className="w-full max-w-none px-4 py-6">
        <Outlet />
      </div>
    </div>
  );
}
