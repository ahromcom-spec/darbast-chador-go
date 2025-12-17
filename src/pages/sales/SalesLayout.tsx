import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, Users, ClipboardCheck, Play, Loader, CheckCircle, Banknote, PackageOpen, ArrowLeftRight, ChevronDown, ListOrdered, DollarSign, Archive } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSalesPendingCount } from '@/hooks/useSalesPendingCount';

// مراحل سفارشات مشتری
const orderStagesItems = [
  {
    title: 'در انتظار تایید مدیران',
    href: '/sales/pending-orders',
    icon: ClipboardCheck
  },
  {
    title: 'در انتظار اجرا',
    href: '/sales/ready',
    icon: Play
  },
  {
    title: 'در حال اجرا',
    href: '/sales/in-progress',
    icon: Loader
  },
  {
    title: 'در انتظار پرداخت',
    href: '/sales/stage-awaiting-payment',
    icon: Banknote
  },
  {
    title: 'در انتظار جمع‌آوری',
    href: '/sales/stage-awaiting-collection',
    icon: PackageOpen
  },
  {
    title: 'تکمیل سفارش',
    href: '/sales/completed',
    icon: CheckCircle
  },
  {
    title: 'همه سفارشات',
    href: '/sales/orders',
    icon: ShoppingCart
  },
];

// آیتم‌های اصلی ناوبری
const mainNavItems = [
  {
    title: 'داشبورد',
    href: '/sales',
    icon: LayoutDashboard
  },
  {
    title: 'مشتریان',
    href: '/sales/customers',
    icon: Users
  },
  {
    title: 'انتقال سفارش',
    href: '/sales/order-transfers',
    icon: ArrowLeftRight
  },
  {
    title: 'سفارشات بایگانی شده',
    href: '/executive/archived-orders',
    icon: Archive
  }
];

export default function SalesLayout() {
  const location = useLocation();
  const { data: pendingCount = 0 } = useSalesPendingCount();
  
  // بررسی اینکه آیا صفحه فعلی یکی از مراحل سفارش است
  const isOrderStageActive = orderStagesItems.some(item => 
    location.pathname === item.href || location.pathname.startsWith(item.href + '/')
  );
  
  // پیدا کردن عنوان مرحله فعلی
  const activeStage = orderStagesItems.find(item => 
    location.pathname === item.href || location.pathname.startsWith(item.href + '/')
  );

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
                end={item.href === '/sales'}
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
                  {activeStage ? activeStage.title : 'مشتریان'}
                  {pendingCount > 0 && !activeStage && (
                    <Badge variant="destructive" className="mr-1 text-xs">
                      {pendingCount}
                    </Badge>
                  )}
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
                      {item.href === '/sales/pending-orders' && pendingCount > 0 && (
                        <Badge variant="destructive" className="mr-auto text-xs">
                          {pendingCount}
                        </Badge>
                      )}
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
}
