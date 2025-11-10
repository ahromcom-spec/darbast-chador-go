import { Outlet, NavLink, Link } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, Users, ClipboardCheck, Play, Loader, CheckCircle, Banknote, CheckSquare, PackageOpen, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAdminRole } from '@/hooks/useAdminRole';
import { useCEORole } from '@/hooks/useCEORole';
import { useExecutiveManagerRole } from '@/hooks/useExecutiveManagerRole';


const navItems = [
  {
    title: 'داشبورد',
    href: '/executive',
    icon: LayoutDashboard
  },
  {
    title: 'کارتابل اجرایی',
    href: '/executive/pending-orders',
    icon: ClipboardCheck
  },
  {
    title: 'آماده اجرا',
    href: '/executive/ready',
    icon: Play
  },
  {
    title: 'در حال اجرا',
    href: '/executive/in-progress',
    icon: Loader
  },
  {
    title: 'در انتظار پرداخت',
    href: '/executive/stage-awaiting-payment',
    icon: Banknote
  },
  {
    title: 'سفارش اجرا شده',
    href: '/executive/stage-order-executed',
    icon: CheckSquare
  },
  {
    title: 'در انتظار جمع‌آوری',
    href: '/executive/stage-awaiting-collection',
    icon: PackageOpen
  },
  {
    title: 'در حال جمع‌آوری',
    href: '/executive/stage-in-collection',
    icon: Truck
  },
  {
    title: 'تکمیل شده',
    href: '/executive/completed',
    icon: CheckCircle
  },
  {
    title: 'همه سفارشات',
    href: '/executive/all-orders',
    icon: ShoppingCart
  },
  {
    title: 'مشتریان',
    href: '/executive/customers',
    icon: Users
  }
];

export function ExecutiveLayout() {
  const { isAdmin } = useAdminRole();
  const { isCEO } = useCEORole();
  const { isExecutiveManager } = useExecutiveManagerRole();
  const canTest = isAdmin || isCEO || isExecutiveManager;
  const testPath = isAdmin ? '/admin/test-order' : '/ceo/test-order';

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="container mx-auto">
          <nav className="flex gap-1 overflow-x-auto py-1">
            {navItems.map((item) => (
              <NavLink
                key={item.href}
                to={item.href}
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
          </nav>
        </div>
      </div>

      {canTest && (
        <div className="border-b bg-muted/30">
          <div className="container mx-auto flex items-center justify-between px-2 py-2">
            <span className="text-xs text-muted-foreground">ابزار تست محیط اجرا</span>
            <Button asChild size="sm" variant="outline" className="h-8">
              <Link to={testPath}>ایجاد سفارش تست</Link>
            </Button>
          </div>
        </div>
      )}

      <div className="container mx-auto p-6">
        <Outlet />
      </div>
    </div>
  );
}

