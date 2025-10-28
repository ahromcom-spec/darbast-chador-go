import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, Users } from 'lucide-react';
import { cn } from '@/lib/utils';


const navItems = [
  {
    title: 'داشبورد',
    href: '/executive',
    icon: LayoutDashboard
  },
  {
    title: 'سفارشات',
    href: '/executive/orders',
    icon: ShoppingCart
  },
  {
    title: 'مشتریان',
    href: '/executive/customers',
    icon: Users
  }
];

export function ExecutiveLayout() {
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
      <div className="container mx-auto p-6">
        
        <Outlet />
      </div>
    </div>
  );
}
