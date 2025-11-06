import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  ClipboardList,
  PlayCircle,
  CheckCircle2,
  DollarSign,
  Package,
  Users
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface NavItem {
  title: string;
  href: string;
  icon: any;
  badge?: number;
}

export function ExecutiveSidebar() {
  const location = useLocation();

  // Fetch counts for each status
  const { data: pendingCount = 0 } = useQuery({
    queryKey: ['executive-pending-count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('projects_v3')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
        .not('subcategory_id', 'is', null);
      return count || 0;
    },
    refetchInterval: 30000
  });

  const { data: approvedCount = 0 } = useQuery({
    queryKey: ['executive-approved-count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('projects_v3')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'approved');
      return count || 0;
    },
    refetchInterval: 30000
  });

  const { data: inProgressCount = 0 } = useQuery({
    queryKey: ['executive-inprogress-count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('projects_v3')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'in_progress');
      return count || 0;
    },
    refetchInterval: 30000
  });

  const { data: completedCount = 0 } = useQuery({
    queryKey: ['executive-completed-count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('projects_v3')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed');
      return count || 0;
    },
    refetchInterval: 30000
  });

  const navItems: NavItem[] = [
    {
      title: 'داشبورد',
      href: '/executive',
      icon: LayoutDashboard
    },
    {
      title: 'در انتظار تایید',
      href: '/executive/pending',
      icon: ClipboardList,
      badge: pendingCount
    },
    {
      title: 'آماده اجرا',
      href: '/executive/ready',
      icon: Package,
      badge: approvedCount
    },
    {
      title: 'در حال اجرا',
      href: '/executive/in-progress',
      icon: PlayCircle,
      badge: inProgressCount
    },
    {
      title: 'در انتظار پرداخت',
      href: '/executive/completed',
      icon: DollarSign,
      badge: completedCount
    },
    {
      title: 'همه سفارشات',
      href: '/executive/all-orders',
      icon: CheckCircle2
    },
    {
      title: 'مشتریان',
      href: '/executive/customers',
      icon: Users
    }
  ];

  return (
    <div className="space-y-2">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.href;

        return (
          <Link
            key={item.href}
            to={item.href}
            className={cn(
              'flex items-center justify-between gap-3 px-4 py-3 rounded-lg transition-all duration-200',
              'hover:bg-accent/50',
              isActive
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <div className="flex items-center gap-3">
              <Icon className="h-5 w-5" />
              <span className="font-medium">{item.title}</span>
            </div>
            {item.badge !== undefined && item.badge > 0 && (
              <Badge 
                variant={isActive ? "secondary" : "default"}
                className={cn(
                  "min-w-[24px] h-6 flex items-center justify-center",
                  isActive && "bg-primary-foreground text-primary"
                )}
              >
                {item.badge}
              </Badge>
            )}
          </Link>
        );
      })}
    </div>
  );
}
