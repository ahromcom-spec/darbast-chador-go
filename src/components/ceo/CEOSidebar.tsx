import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Shield,
  UserCheck,
  Users,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const menuItems = [
  {
    title: 'داشبورد',
    icon: LayoutDashboard,
    href: '/ceo',
  },
  {
    title: 'مدیریت دسترسی',
    icon: Shield,
    href: '/ceo/whitelist',
  },
  {
    title: 'تأیید پیمانکاران',
    icon: UserCheck,
    href: '/ceo/contractor-verifications',
  },
  {
    title: 'تأیید پرسنل',
    icon: Users,
    href: '/ceo/staff-verifications',
  },
];

export const CEOSidebar = () => {
  return (
    <aside className="w-64 bg-card border-l border-border min-h-screen">
      <div className="p-6 border-b border-border">
        <h2 className="text-lg font-semibold text-foreground">پنل مدیریت CEO</h2>
      </div>

      <nav className="p-4 space-y-2">
        {menuItems.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            end={item.href === '/ceo'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                'hover:bg-accent hover:text-accent-foreground',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground'
              )
            }
          >
            <item.icon className="h-5 w-5" />
            <span className="flex-1">{item.title}</span>
            <ChevronRight className="h-4 w-4" />
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};
