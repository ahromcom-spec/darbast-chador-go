import { Outlet, NavLink, useLocation, Navigate, useSearchParams, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, Banknote, Clock, CheckCircle, DollarSign, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useModuleAssignmentInfo } from '@/hooks/useModuleAssignmentInfo';

// نقش‌های مجاز برای دسترسی به پنل حسابداری
const ALLOWED_ROLES = [
  'admin',
  'ceo',
  'general_manager',
  'finance_manager'
];

// مراحل سفارشات حسابداری
const orderStagesItems = [
  {
    title: 'در انتظار پرداخت',
    href: '/finance/awaiting-payment',
    icon: Clock
  },
  {
    title: 'پرداخت شده',
    href: '/finance/paid',
    icon: DollarSign
  },
  {
    title: 'اتمام و فک شده',
    href: '/finance/closed',
    icon: CheckCircle
  },
  {
    title: 'همه سفارشات',
    href: '/finance/all-orders',
    icon: ShoppingCart
  },
];

// آیتم‌های اصلی ناوبری
const mainNavItems = [
  {
    title: 'داشبورد',
    href: '/finance',
    icon: LayoutDashboard
  },
  {
    title: 'تاریخچه پرداخت‌ها',
    href: '/finance/payments',
    icon: Banknote
  }
];

export function FinanceLayout() {
  const { user, loading: authLoading } = useAuth();
  const [hasAccess, setHasAccess] = useState(false);
  const [roleLoading, setRoleLoading] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activeModuleKey = searchParams.get('moduleKey') || 'accounting_module';
  const { moduleName } = useModuleAssignmentInfo(activeModuleKey, 'ماژول حسابداری', '');

  useEffect(() => {
    const checkFinanceRole = async () => {
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
          console.error('Error checking finance role:', error);
          setHasAccess(false);
        } else {
          const userRoles = data?.map(r => r.role) || [];
          const hasAllowedRole = userRoles.some(role => ALLOWED_ROLES.includes(role));
          setHasAccess(hasAllowedRole);
        }
      } catch (error) {
        console.error('Error checking finance role:', error);
        setHasAccess(false);
      } finally {
        setRoleLoading(false);
      }
    };

    checkFinanceRole();
  }, [user]);
  
  // بررسی اینکه آیا صفحه فعلی یکی از مراحل سفارش است
  const isOrderStageActive = orderStagesItems.some(item => 
    location.pathname === item.href || location.pathname.startsWith(item.href + '/')
  );
  
  // پیدا کردن عنوان مرحله فعلی
  const activeStage = orderStagesItems.find(item => 
    location.pathname === item.href || location.pathname.startsWith(item.href + '/')
  );

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

  if (!user || !hasAccess) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Module Name Header */}
      <div className="bg-green-50 dark:bg-green-950/30 border-b border-green-200 dark:border-green-800">
        <div className="container mx-auto px-4 py-2 flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/profile?tab=modules')}
            className="gap-2"
          >
            بازگشت
            <ArrowRight className="h-4 w-4" />
          </Button>
          <p className="text-sm font-medium text-green-700 dark:text-green-300">
            {moduleName}
          </p>
        </div>
      </div>
      
      <div className="border-b bg-card">
        <div className="container mx-auto">
          <nav className="flex gap-1 overflow-x-auto py-1">
            {/* آیتم‌های اصلی ناوبری */}
            {mainNavItems.map((item) => (
              <NavLink
                key={item.href}
                to={`${item.href}?moduleKey=${activeModuleKey}`}
                end={item.href === '/finance'}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all whitespace-nowrap',
                    'hover:bg-muted',
                    isActive 
                      ? 'bg-primary text-primary-foreground' 
                      : 'text-muted-foreground hover:text-foreground'
                  )
                }
              >
                <item.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{item.title}</span>
              </NavLink>
            ))}
            
            {/* Dropdown برای مراحل سفارش */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all whitespace-nowrap',
                    'hover:bg-muted',
                    isOrderStageActive 
                      ? 'bg-primary text-primary-foreground' 
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <ShoppingCart className="h-4 w-4" />
                  <span className="hidden sm:inline">
                    {isOrderStageActive && activeStage ? activeStage.title : 'مراحل سفارش'}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
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
          </nav>
        </div>
      </div>
      
      <main className="container mx-auto py-6 px-4">
        <Outlet />
      </main>
    </div>
  );
}

export default FinanceLayout;
