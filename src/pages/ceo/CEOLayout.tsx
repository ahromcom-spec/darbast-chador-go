import { Outlet, Navigate, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  LayoutDashboard, 
  Users, 
  ArrowLeftRight, 
  ClipboardCheck, 
  Play, 
  Loader, 
  CheckCircle, 
  Banknote, 
  PackageOpen, 
  ShoppingCart,
  ChevronDown,
  ListOrdered,
  Shield,
  UserCheck,
  Archive,
  ArchiveX
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from '@/components/ui/button';

// مراحل سفارشات مشتری
const orderStagesItems = [
  {
    title: 'در انتظار تایید مدیران',
    href: '/ceo/pending-orders',
    icon: ClipboardCheck
  },
  {
    title: 'در انتظار اجرا',
    href: '/ceo/ready',
    icon: Play
  },
  {
    title: 'در حال اجرا',
    href: '/ceo/in-progress',
    icon: Loader
  },
  {
    title: 'در انتظار پرداخت',
    href: '/ceo/stage-awaiting-payment',
    icon: Banknote
  },
  {
    title: 'در انتظار جمع‌آوری',
    href: '/ceo/stage-awaiting-collection',
    icon: PackageOpen
  },
  {
    title: 'تکمیل سفارش',
    href: '/ceo/completed',
    icon: CheckCircle
  },
  {
    title: 'همه سفارشات',
    href: '/ceo/orders',
    icon: ShoppingCart
  },
];

// آیتم‌های اصلی ناوبری
const mainNavItems = [
  {
    title: 'داشبورد',
    href: '/ceo',
    icon: LayoutDashboard
  },
  {
    title: 'مشتریان',
    href: '/ceo/customers',
    icon: Users
  },
  {
    title: 'انتقال سفارش',
    href: '/ceo/order-transfers',
    icon: ArrowLeftRight
  },
  {
    title: 'مدیریت دسترسی',
    href: '/ceo/whitelist',
    icon: Shield
  },
  {
    title: 'تأیید پیمانکاران',
    href: '/ceo/contractor-verifications',
    icon: UserCheck
  },
  {
    title: 'تأیید پرسنل',
    href: '/ceo/staff-verifications',
    icon: Users
  },
  {
    title: 'بایگانی سفارشات',
    href: '/ceo/archived',
    icon: Archive
  },
  {
    title: 'بایگانی عمیق',
    href: '/ceo/deep-archived',
    icon: ArchiveX
  },
];

// نقش‌هایی که اجازه دسترسی به ماژول گزارش روزانه دارند
const ALLOWED_ROLES = ['ceo', 'general_manager', 'scaffold_executive_manager', 'executive_manager_scaffold_execution_with_materials'] as const;

export const CEOLayout = () => {
  const { user, loading: authLoading } = useAuth();
  const [hasAccess, setHasAccess] = useState(false);
  const [roleLoading, setRoleLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    const checkRoles = async () => {
      if (!user) {
        setHasAccess(false);
        setRoleLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .in('role', ALLOWED_ROLES);

        if (error) {
          console.error('Error checking roles:', error);
          setHasAccess(false);
        } else {
          setHasAccess(data && data.length > 0);
        }
      } catch (error) {
        console.error('Error checking roles:', error);
        setHasAccess(false);
      } finally {
        setRoleLoading(false);
      }
    };

    checkRoles();
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
      <div className="border-b bg-card">
        <div className="container mx-auto">
          <nav className="flex gap-1 overflow-x-auto py-1">
            {/* آیتم‌های اصلی ناوبری */}
            {mainNavItems.map((item) => (
              <NavLink
                key={item.href}
                to={item.href}
                end={item.href === '/ceo'}
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
                      to={item.href}
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

      <div className="container mx-auto p-6">
        <Outlet />
      </div>
    </div>
  );
};
